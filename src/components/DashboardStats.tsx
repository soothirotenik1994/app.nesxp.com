import React from 'react';
import { useTranslation } from 'react-i18next';
import { Car, Users, Activity, Signal } from 'lucide-react';

interface StatsProps {
  totalVehicles: number;
  onlineVehicles: number;
  offlineVehicles: number;
  totalMembers: number;
  showOnlyTotal?: boolean;
}

export const DashboardStats: React.FC<StatsProps> = ({
  totalVehicles,
  onlineVehicles,
  offlineVehicles,
  totalMembers,
  showOnlyTotal = false
}) => {
  const { t } = useTranslation();
  const allStats = [
    {
      name: t('total_vehicles'),
      value: totalVehicles,
      icon: Car,
      color: 'bg-primary',
      textColor: 'text-primary'
    },
    {
      name: t('online_vehicles'),
      value: onlineVehicles,
      icon: Signal,
      color: 'bg-primary',
      textColor: 'text-primary'
    },
    {
      name: t('offline_vehicles'),
      value: offlineVehicles,
      icon: Activity,
      color: 'bg-secondary',
      textColor: 'text-secondary'
    },
    {
      name: t('total_members'),
      value: totalMembers,
      icon: Users,
      color: 'bg-secondary',
      textColor: 'text-secondary'
    }
  ];

  const stats = showOnlyTotal ? [allStats[0]] : allStats;

  return (
    <div className={`grid grid-cols-1 gap-4 lg:gap-6 ${showOnlyTotal ? 'md:grid-cols-1 lg:grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
      {stats.map((stat) => (
        <div key={stat.name} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className={`${stat.color} p-3 rounded-xl`}>
              <stat.icon className="w-6 h-6 text-white" />
            </div>
            <span className={`text-2xl font-bold ${stat.textColor}`}>
              {stat.value}
            </span>
          </div>
          <p className="text-slate-500 font-medium text-sm">{stat.name}</p>
        </div>
      ))}
    </div>
  );
};
