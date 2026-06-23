// JNI bridge that runs Stockfish's UCI loop on a background thread and pipes
// its stdin/stdout to/from the JS side. This is the well-worn approach used by
// React Native Stockfish wrappers: redirect the process std streams to pipes,
// launch Stockfish's (renamed) main on a thread, then read/write lines.
#include <jni.h>
#include <android/log.h>
#include <unistd.h>
#include <pthread.h>
#include <cstdio>
#include <cstring>
#include <string>

#define LOG_TAG "StockfishJNI"
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// Stockfish entry point (main.cpp is compiled with -Dmain=stockfish_main).
extern "C" int stockfish_main(int argc, char* argv[]);

static int s_inPipe[2]  = {-1, -1};   // JS  -> Stockfish stdin
static int s_outPipe[2] = {-1, -1};   // Stockfish stdout -> JS
static bool s_started = false;

static void* engineThread(void*) {
  char arg0[] = "stockfish";
  char* argv[] = { arg0, nullptr };
  stockfish_main(1, argv);
  return nullptr;
}

extern "C" JNIEXPORT jint JNICALL
Java_expo_modules_stockfish_StockfishModule_nativeInit(JNIEnv*, jobject) {
  if (s_started) return 0;

  if (pipe(s_inPipe) != 0 || pipe(s_outPipe) != 0) {
    LOGE("pipe() failed");
    return -1;
  }

  // Stockfish reads stdin from s_inPipe[0] and writes stdout to s_outPipe[1].
  if (dup2(s_inPipe[0], STDIN_FILENO) == -1 ||
      dup2(s_outPipe[1], STDOUT_FILENO) == -1 ||
      dup2(s_outPipe[1], STDERR_FILENO) == -1) {
    LOGE("dup2() failed");
    return -2;
  }

  // Unbuffered so UCI output is delivered line-by-line without flush delays.
  setvbuf(stdout, nullptr, _IONBF, 0);
  setvbuf(stderr, nullptr, _IONBF, 0);

  pthread_t t;
  if (pthread_create(&t, nullptr, engineThread, nullptr) != 0) {
    LOGE("pthread_create() failed");
    return -3;
  }
  pthread_detach(t);
  s_started = true;
  return 0;
}

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_stockfish_StockfishModule_nativeWrite(JNIEnv* env, jobject, jstring cmd) {
  if (s_inPipe[1] < 0) return;
  const char* s = env->GetStringUTFChars(cmd, nullptr);
  if (!s) return;
  std::string line(s);
  env->ReleaseStringUTFChars(cmd, s);
  line.push_back('\n');
  ssize_t off = 0, len = (ssize_t)line.size();
  while (off < len) {
    ssize_t n = write(s_inPipe[1], line.c_str() + off, len - off);
    if (n <= 0) break;
    off += n;
  }
}

// Blocking read of a single line of Stockfish output. The Kotlin side calls
// this in a loop on a dedicated reader thread and forwards each line as an
// event. Returns null on EOF.
extern "C" JNIEXPORT jstring JNICALL
Java_expo_modules_stockfish_StockfishModule_nativeReadLine(JNIEnv* env, jobject) {
  if (s_outPipe[0] < 0) return nullptr;
  std::string line;
  char c;
  while (true) {
    ssize_t n = read(s_outPipe[0], &c, 1);
    if (n <= 0) {
      if (line.empty()) return nullptr;
      break;
    }
    if (c == '\n') break;
    if (c != '\r') line.push_back(c);
  }
  return env->NewStringUTF(line.c_str());
}
