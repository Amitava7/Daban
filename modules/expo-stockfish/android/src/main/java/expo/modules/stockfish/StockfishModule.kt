package expo.modules.stockfish

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.concurrent.thread

// Thin Expo module wrapping the native Stockfish UCI bridge.
//   start()          -> launch the engine + reader thread
//   write(command)   -> send a raw UCI command
//   onMessage event  -> one line of UCI output ({ "line": String })
class StockfishModule : Module() {

  private external fun nativeInit(): Int
  private external fun nativeWrite(cmd: String)
  private external fun nativeReadLine(): String?

  @Volatile private var running = false
  private var reader: Thread? = null

  companion object {
    init {
      System.loadLibrary("stockfish")
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoStockfish")

    Events("onMessage")

    Function("start") {
      if (running) return@Function true
      val rc = nativeInit()
      if (rc != 0) return@Function false
      running = true
      reader = thread(start = true, isDaemon = true, name = "stockfish-reader") {
        while (running) {
          val line = nativeReadLine() ?: break
          sendEvent("onMessage", mapOf("line" to line))
        }
      }
      true
    }

    Function("write") { command: String ->
      nativeWrite(command)
    }
  }
}
