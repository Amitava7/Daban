import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { GameProvider } from './src/context/GameContext';
import { ProgressProvider } from './src/context/ProgressContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { Stockfish } from './src/engine/StockfishUci';

function Root() {
  const { mode } = useTheme();

  // Warm up the native Stockfish engine at launch so the first coach move is
  // instant. Safe no-op when the native module is absent.
  useEffect(() => {
    if (Stockfish.available) {
      Stockfish.ensureReady().catch(() => {});
    }
  }, []);

  return (
    <>
      <AppNavigator />
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ProgressProvider>
        <GameProvider>
          <Root />
        </GameProvider>
      </ProgressProvider>
    </ThemeProvider>
  );
}
