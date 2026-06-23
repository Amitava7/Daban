import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { GameProvider } from './src/context/GameContext';
import { ProgressProvider } from './src/context/ProgressContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { stockfishSelfTest } from './src/engine/StockfishUci';

function Root() {
  const { mode } = useTheme();

  // One-shot: benchmark the native Stockfish engine on this device and record
  // the result to the debug log. Safe no-op when the native module is absent.
  useEffect(() => {
    stockfishSelfTest();
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
