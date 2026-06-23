cmake_minimum_required(VERSION 3.22.1)
project(stockfish CXX ASM)

include(FetchContent)

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

# ---------------------------------------------------------------------------
# Download the NNUE network(s) this Stockfish version embeds. The default net
# filenames are declared in evaluate.h; we parse them out and fetch each from
# the official net distribution so incbin can embed them at compile time.
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
    message(STATUS "Stockfish: downloading net ${netname}")
    file(DOWNLOAD
      https://tests.stockfishchess.org/api/nn/${netname}
      ${SF_SRC}/${netname}
      STATUS dl_status
      TLS_VERIFY ON
    )
    list(GET dl_status 0 dl_code)
    if(NOT dl_code EQUAL 0)
      message(FATAL_ERROR "Failed to download net ${netname}: ${dl_status}")
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

# Arch tuning for the S24 Ultra (Snapdragon 8 Gen 3): armv8.2-a with the
# dot-product extension, which Stockfish's NNUE uses on ARM.
target_compile_options(stockfish PRIVATE
  -O3
  -std=c++17
  -march=armv8.2-a+dotprod
  -fexceptions
  # Let the assembler find the .nnue files referenced by incbin.
  "-Wa,-I${SF_SRC}"
)

target_compile_definitions(stockfish PRIVATE
  NDEBUG
  IS_64BIT
  USE_POPCNT
  USE_NEON=8
  USE_NEON_DOTPROD
)

find_library(log-lib log)
target_link_libraries(stockfish ${log-lib})
