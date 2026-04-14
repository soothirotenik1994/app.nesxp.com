import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ListOrdered, 
  Search, 
  Car as CarIcon, 
  MapPin, 
  ArrowUpRight, 
  ArrowDownRight,
  Minus,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { directusApi } from '../api/directus';
import { Car, WorkReport } from '../types';
import { cn } from '../lib/utils';

interface QueueData {
  car: Car;
  count_bkk: number;
  count_upcountry: number;
  priority_score: number;
  recommendation: 'upcountry' | 'bkk' | 'normal';
}

export const VehicleQueue: React.FC = () => {
  const { t } = useTranslation();
  const [queueData, setQueueData] = useState<QueueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all cars and all work reports
      const [cars, reports] = await Promise.all([
        directusApi.getCars(),
        directusApi.getWorkReports() // This fetches work_reports
      ]);

      // Calculate queue data
      const calculatedData: QueueData[] = cars.map(car => {
        // Filter reports for this car
        // A report might have car_id as a string or an object depending on the API response
        const carReports = reports.filter(r => {
          const reportCarId = typeof r.car_id === 'object' ? r.car_id?.id : r.car_id;
          return reportCarId === car.id && r.status !== 'deleted' && r.status !== 'cancelled';
        });

        let count_bkk = 0;
        let count_upcountry = 0;
        
        const bkkMaxDistance = parseInt(localStorage.getItem('bkk_max_distance') || '250', 10);

        carReports.forEach(report => {
          const distance = report.estimated_distance || 0;
          if (distance > bkkMaxDistance) {
            count_upcountry++;
          } else {
            count_bkk++;
          }
        });

        const priority_score = count_bkk / (count_upcountry + 1);

        let recommendation: 'upcountry' | 'bkk' | 'normal' = 'normal';
        if (count_bkk - count_upcountry > 3) {
          recommendation = 'upcountry';
        } else if (count_upcountry - count_bkk > 2) {
          recommendation = 'bkk';
        }

        return {
          car,
          count_bkk,
          count_upcountry,
          priority_score,
          recommendation
        };
      });

      // Sort by priority score descending
      calculatedData.sort((a, b) => b.priority_score - a.priority_score);
      
      setQueueData(calculatedData);
    } catch (err) {
      console.error('Error fetching queue data:', err);
      setError('ไม่สามารถโหลดข้อมูลคิวรถได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredQueue = queueData.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    return (
      item.car.car_number.toLowerCase().includes(searchLower) ||
      (item.car.owner_name && item.car.owner_name.toLowerCase().includes(searchLower)) ||
      (item.car.brand_id && typeof item.car.brand_id === 'object' && item.car.brand_id.name.toLowerCase().includes(searchLower))
    );
  });

  const getRecommendationBadge = (recommendation: string) => {
    switch (recommendation) {
      case 'upcountry':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium">
            <ArrowUpRight className="w-4 h-4" />
            ควรได้งานต่างจังหวัด
          </span>
        );
      case 'bkk':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
            <ArrowDownRight className="w-4 h-4" />
            ควรได้งานกรุงเทพฯ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">
            <Minus className="w-4 h-4" />
            ปกติ
          </span>
        );
    }
  };

  const isQueueSystemEnabled = localStorage.getItem('enable_queue_system') !== 'false';
  const bkkMaxDistance = parseInt(localStorage.getItem('bkk_max_distance') || '250', 10);

  return (
    <div className="space-y-6">
      {!isQueueSystemEnabled && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-bold">ระบบจัดลำดับคิวรถถูกปิดใช้งานอยู่</p>
            <p className="text-sm mt-1">ระบบจะไม่แนะนำคิวรถอัตโนมัติในหน้า "จ่ายงานใหม่" คุณสามารถเปิดใช้งานได้ที่เมนู "ตั้งค่าระบบ"</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ListOrdered className="w-8 h-8 text-primary" />
            ระบบจัดลำดับคิวรถ
          </h1>
          <p className="text-gray-500 mt-1">คำนวณลำดับคิวอัตโนมัติจากประวัติการวิ่งงาน (กทม. vs ต่างจังหวัด)</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาทะเบียนรถ, ชื่อคนขับ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-sm font-bold text-gray-500">ลำดับ</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-500">ข้อมูลรถ</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-500 text-center">งาน กทม.<br/><span className="text-xs font-normal text-gray-400">(≤ {bkkMaxDistance} กม.)</span></th>
                <th className="px-6 py-4 text-sm font-bold text-gray-500 text-center">งานต่างจังหวัด<br/><span className="text-xs font-normal text-gray-400">(&gt; {bkkMaxDistance} กม.)</span></th>
                <th className="px-6 py-4 text-sm font-bold text-gray-500 text-center">Priority Score<br/><span className="text-xs font-normal text-gray-400">(กทม. / (ตจว. + 1))</span></th>
                <th className="px-6 py-4 text-sm font-bold text-gray-500">สถานะคิวถัดไป</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-gray-500">กำลังคำนวณลำดับคิว...</p>
                  </td>
                </tr>
              ) : filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    ไม่พบข้อมูลรถที่ค้นหา
                  </td>
                </tr>
              ) : (
                filteredQueue.map((item, index) => (
                  <tr key={item.car.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                        index === 0 ? "bg-amber-100 text-amber-700" :
                        index === 1 ? "bg-gray-200 text-gray-700" :
                        index === 2 ? "bg-orange-100 text-orange-700" :
                        "bg-gray-50 text-gray-500"
                      )}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <CarIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{item.car.car_number}</p>
                          <p className="text-sm text-gray-500">{item.car.owner_name || 'ไม่ระบุคนขับ'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-lg font-bold">
                        {item.count_bkk}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-3 py-1 bg-purple-50 text-purple-700 rounded-lg font-bold">
                        {item.count_upcountry}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-mono font-bold text-lg text-gray-900">
                        {item.priority_score.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getRecommendationBadge(item.recommendation)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
