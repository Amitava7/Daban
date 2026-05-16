import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { GameScreen } from '../screens/GameScreen';
import { HintScreen } from '../screens/HintScreen';
import { FeedbackScreen } from '../screens/FeedbackScreen';
import { RefutationScreen } from '../screens/RefutationScreen';
import { ReviewScreen } from '../screens/ReviewScreen';
import { OpeningsScreen } from '../screens/OpeningsScreen';
import { EndgamesScreen } from '../screens/EndgamesScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { colors } = useTheme();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Game" component={GameScreen} />
        <Stack.Screen name="Hint" component={HintScreen} />
        <Stack.Screen name="Feedback" component={FeedbackScreen} />
        <Stack.Screen name="Refutation" component={RefutationScreen} />
        <Stack.Screen name="Review" component={ReviewScreen} />
        <Stack.Screen name="Openings" component={OpeningsScreen} />
        <Stack.Screen name="Endgames" component={EndgamesScreen} />
        <Stack.Screen name="Progress" component={ProgressScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
