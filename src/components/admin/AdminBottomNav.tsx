import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export type AdminTab = 'overview' | 'products' | 'orders' | 'vouchers' | 'settings';

type AdminBottomNavProps = {
  activeTab?: AdminTab;
};

const TAB_CONFIG: {
  id: AdminTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}[] = [
  {
    id: 'overview',
    label: 'Tổng quan',
    icon: 'grid-outline',
    route: '/(admin)/statistics',
  },
  {
    id: 'products',
    label: 'Sản phẩm',
    icon: 'cube-outline',
    route: '/(admin)/products',
  },
  {
    id: 'orders',
    label: 'Đơn hàng',
    icon: 'receipt-outline',
    route: '/(admin)/orders',
  },
  {
    id: 'vouchers',
    label: 'Khuyến mãi',
    icon: 'ticket-outline',
    route: '/(admin)/vouchers',
  },
  {
    id: 'settings',
    label: 'Cài đặt',
    icon: 'settings-outline',
    route: '/(admin)/reviews',
  },
];

export function AdminBottomNav({ activeTab = 'orders' }: AdminBottomNavProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {TAB_CONFIG.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabButton}
            activeOpacity={0.7}
            onPress={() => {
              if (!isActive) {
                router.push(tab.route as any);
              }
            }}
          >
            <Ionicons
              name={tab.icon}
              size={22}
              color={isActive ? '#00BCD4' : '#8A8F9C'}
            />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8A8F9C',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#00BCD4',
    fontWeight: '600',
  },
});

