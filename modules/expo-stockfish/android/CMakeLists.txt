cmake_minimum_required(VERSION 3.22.1)
project(stockfish CXX ASM)

include(FetchContent)
find_package(Git REQUIRED)

# ---------------------------------------------------------------------------
# Which NNUE network(s) to embed.
#
# Stockfish 16.1 ships two nets and bakes both into the binary with incbin:
# the "big" one (nn-b1a57edbea57.nnue, 65 MB) and the "small" one
# (nn-baff1ede1f90.nnue, 3.3 MB). Those 69 MB dwarfed everything else in the
# APK, so the default build here retargets the big network at the small
# architecture and embeds a single 3.3 MB net — see docs/APK_SIZE.md for the
# size/strength trade-off and the measurements behind it.
#
# Pass -DSTOCKFISH_NET=big (gradle: -Pdaban.stockfishNet=big) to build the
# stock dual-net engine instead.
# ---------------------------------------------------------------------------
set(STOCKFISH_NET "small" CACHE STRING "Embedded NNUE net: small (3.3 MB) or big (65 MB + 3.3 MB)")
set_property(CACHE STOCKFISH_NET PROPERTY STRINGS small big)
if(NOT STOCKFISH_NET MATCHES "^(small|big)$")
  message(FATAL_ERROR "STOCKFISH_NET must be 'small' or 'big', got '${STOCKFISH_NET}'")
endif()

# ---------------------------------------------------------------------------
# Fetch the Stockfish source (it ships no CMakeLists, so we drive the build
# ourselves) at a pinned release tag.
# ---------------------------------------------------------------------------
set(SF_TAG "sf_16.1")
FetchContent_Declare(
  stockfish
  GIT_REPOSITORY https://github.com/official-stockfish/Stockfish.git
  GIT_TAG ${SF_TAG}
  GIT_SHALLOW TRUE
)
FetchContent_GetProperties(stockfish)
if(NOT stockfish_POPULATED)
  FetchContent_Populate(stockfish)
endif()
set(SF_SRC ${stockfish_SOURCE_DIR}/src)

# Start from pristine upstream sources on every configure so switching
# STOCKFISH_NET (or bumping SF_TAG) never leaves a half-patched tree behind.
# Downloaded .nnue files are untracked, so they survive this.
execute_process(
  COMMAND ${GIT_EXECUTABLE} checkout -- .
  WORKING_DIRECTORY ${stockfish_SOURCE_DIR}
  RESULT_VARIABLE sf_restore_result
)
if(NOT sf_restore_result EQUAL 0)
  message(FATAL_ERROR "Could not restore pristine Stockfish sources in ${stockfish_SOURCE_DIR}")
endif()

# Fail loudly rather than silently shipping a 70 MB engine if a future
# Stockfish bump moves the code these edits target.
function(sf_patch_file path needle haystack_var)
  string(FIND "${${haystack_var}}" "${needle}" _found)
  if(_found EQUAL -1)
    message(FATAL_ERROR
      "Small-net patch no longer applies to ${path}: could not find \"${needle}\". "
      "Re-check the patch against Stockfish ${SF_TAG}, or build with -DSTOCKFISH_NET=big.")
  endif()
endfunction()

if(STOCKFISH_NET STREQUAL "small")
  # 1. Point the big net's default filename at the small net, so both networks
  #    load from the same file and only that file needs embedding.
  file(READ ${SF_SRC}/evaluate.h SF_EVAL_H)
  string(REGEX MATCH "#define EvalFileDefaultNameSmall \"([^\"]+)\"" _ignored "${SF_EVAL_H}")
  set(SF_SMALL_NET "${CMAKE_MATCH_1}")
  if(NOT SF_SMALL_NET)
    message(FATAL_ERROR "Could not read EvalFileDefaultNameSmall from ${SF_SRC}/evaluate.h")
  endif()
  sf_patch_file(evaluate.h "#define EvalFileDefaultNameBig" SF_EVAL_H)
  string(REGEX REPLACE "(#define EvalFileDefaultNameBig[ \t]+\")[^\"]+" "\\1${SF_SMALL_NET}"
         SF_EVAL_H "${SF_EVAL_H}")
  file(WRITE ${SF_SRC}/evaluate.h "${SF_EVAL_H}")

  # 2. Give the big network the small network's architecture, so the shared
  #    file's architecture hash matches when either one is loaded.
  file(READ ${SF_SRC}/nnue/nnue_architecture.h SF_ARCH_H)
  string(REGEX MATCH "TransformedFeatureDimensionsSmall[ \t]*=[ \t]*([0-9]+);" _ignored "${SF_ARCH_H}")
  set(SF_SMALL_DIMS "${CMAKE_MATCH_1}")
  if(NOT SF_SMALL_DIMS)
    message(FATAL_ERROR "Could not read TransformedFeatureDimensionsSmall from nnue_architecture.h")
  endif()
  sf_patch_file(nnue_architecture.h "TransformedFeatureDimensionsBig" SF_ARCH_H)
  string(REGEX REPLACE "(TransformedFeatureDimensionsBig[ \t]*=[ \t]*)[0-9]+;" "\\1${SF_SMALL_DIMS};"
         SF_ARCH_H "${SF_ARCH_H}")
  file(WRITE ${SF_SRC}/nnue/nnue_architecture.h "${SF_ARCH_H}")

  # 3. Embed the file once: drop the big net's incbin and read the big
  #    network's parameters out of the small net's embedded copy.
  file(READ ${SF_SRC}/evaluate.cpp SF_EVAL_CPP)
  foreach(needle
      "INCBIN(EmbeddedNNUEBig, EvalFileDefaultNameBig);"
      "netSize == Small ? gEmbeddedNNUESmallData : gEmbeddedNNUEBigData"
      "netSize == Small ? gEmbeddedNNUESmallSize : gEmbeddedNNUEBigSize")
    sf_patch_file(evaluate.cpp "${needle}" SF_EVAL_CPP)
  endforeach()
  string(REPLACE "INCBIN(EmbeddedNNUEBig, EvalFileDefaultNameBig);\n" ""
         SF_EVAL_CPP "${SF_EVAL_CPP}")
  string(REPLACE "netSize == Small ? gEmbeddedNNUESmallData : gEmbeddedNNUEBigData"
                 "gEmbeddedNNUESmallData" SF_EVAL_CPP "${SF_EVAL_CPP}")
  string(REPLACE "netSize == Small ? gEmbeddedNNUESmallSize : gEmbeddedNNUEBigSize"
                 "gEmbeddedNNUESmallSize" SF_EVAL_CPP "${SF_EVAL_CPP}")
  string(REPLACE "(void) gEmbeddedNNUEBigEnd;  // Silence warning on unused variable\n" ""
         SF_EVAL_CPP "${SF_EVAL_CPP}")
  file(WRITE ${SF_SRC}/evaluate.cpp "${SF_EVAL_CPP}")

  message(STATUS "Stockfish: small-net build, embedding ${SF_SMALL_NET} only")
else()
  message(STATUS "Stockfish: stock dual-net build (adds ~65 MB to the APK)")
endif()

# ---------------------------------------------------------------------------
# Download the NNUE network(s) this Stockfish build embeds. The net filenames
# are declared in evaluate.h (patched above for the small-net build); we parse
# them out and fetch each one so incbin can embed it at compile time.
# ---------------------------------------------------------------------------
file(STRINGS ${SF_SRC}/evaluate.h NET_LINES REGEX "nn-[0-9a-f]+\\.nnue")
set(NET_NAMES "")
foreach(line ${NET_LINES})
  string(REGEX MATCH "nn-[0-9a-f]+\\.nnue" netname "${line}")
  if(netname)
    list(APPEND NET_NAMES ${netname})
  endif()
endforeach()
list(REMOVE_DUPLICATES NET_NAMES)
foreach(netname ${NET_NAMES})
  if(NOT EXISTS ${SF_SRC}/${netname})
    set(net_downloaded FALSE)
    # The official net server first, then the GitHub mirror for build
    # environments that cannot reach it.
    foreach(net_url
        https://tests.stockfishchess.org/api/nn/${netname}
        https://raw.githubusercontent.com/official-stockfish/networks/master/${netname})
      if(NOT net_downloaded)
        message(STATUS "Stockfish: downloading net ${netname} from ${net_url}")
        file(DOWNLOAD ${net_url} ${SF_SRC}/${netname} STATUS dl_status TLS_VERIFY ON)
        list(GET dl_status 0 dl_code)
        if(dl_code EQUAL 0)
          set(net_downloaded TRUE)
        else()
          file(REMOVE ${SF_SRC}/${netname})
          message(STATUS "Stockfish: ${net_url} failed (${dl_status})")
        endif()
      endif()
    endforeach()
    if(NOT net_downloaded)
      message(FATAL_ERROR "Failed to download net ${netname} from any mirror")
    endif()
  endif()
endforeach()

# ---------------------------------------------------------------------------
# Build the engine + JNI bridge into a single shared library: libstockfish.so
# ---------------------------------------------------------------------------
file(GLOB_RECURSE SF_SOURCES ${SF_SRC}/*.cpp)

# Stockfish's main() is renamed so we can launch its UCI loop from a thread
# without clashing with the host process entry point.
set_source_files_properties(${SF_SRC}/main.cpp PROPERTIES
  COMPILE_DEFINITIONS "main=stockfish_main")

add_library(stockfish SHARED
  ${SF_SOURCES}
  ${CMAKE_CURRENT_SOURCE_DIR}/src/main/cpp/stockfish_jni.cpp
)

target_include_directories(stockfish PRIVATE ${SF_SRC})

target_compile_options(stockfish PRIVATE
  -O3
  -std=c++17
  -fexceptions
  # Let the linker drop everything the JNI bridge never reaches.
  -ffunction-sections
  -fdata-sections
  # Let the assembler find the .nnue files referenced by incbin.
  "-Wa,-I${SF_SRC}"
)

target_link_options(stockfish PRIVATE -Wl,--gc-sections)

target_compile_definitions(stockfish PRIVATE
  NDEBUG
  IS_64BIT
  USE_POPCNT
)

# Arch tuning for the S24 Ultra (Snapdragon 8 Gen 3): armv8.2-a with the
# dot-product extension, which Stockfish's NNUE uses on ARM. Guarded so the
# same CMakeLists still configures/builds on a host machine for testing.
if(ANDROID AND ANDROID_ABI STREQUAL "arm64-v8a")
  target_compile_options(stockfish PRIVATE -march=armv8.2-a+dotprod)
  target_compile_definitions(stockfish PRIVATE USE_NEON=8 USE_NEON_DOTPROD)
endif()

if(ANDROID)
  find_library(log-lib log)
  target_link_libraries(stockfish ${log-lib})
endif()
