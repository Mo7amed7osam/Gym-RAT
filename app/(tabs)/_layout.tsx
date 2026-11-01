import { Tabs } from 'expo-router';
import { ChartColumn, House } from 'lucide-react-native';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';


export default function TabLayout() {
  const theme = useTheme();
  const t = useT();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.tint,
        tabBarInactiveTintColor: theme.colors.labelSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.separator,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.today'),
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('tabs.history'),
          tabBarIcon: ({ color, size }) => <ChartColumn color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
