import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Select from 'react-select';
import { directusApi, api, DIRECTUS_URL, STATIC_API_KEY } from '../api/directus';
import { lineService } from '../services/lineService';
import { CountdownTimer } from '../components/CountdownTimer';
import { Car, Member, CustomerLocation, ExpenseItem } from '../types';
import clsx from 'clsx';
import EXIF from 'exif-js';
import { 
  Calendar, 
  Building2, 
  MapPin, 
  ArrowUpRight, 
  ArrowDownRight,
  Minus,
  Truck, 
  User, 
  Phone, 
  Hash,
  Clock, 
  Gauge, 
  FileText, 
  Camera, 
  Send, 
  Save,
  CheckCircle2,
  Circle,
  X,
  Plus,
  AlertCircle,
  Trash2,
  AlertTriangle,
  MessageSquare,
  Package,
  Weight,
  Coins,
  Search,
  Link,
  Navigation,
  PenTool,
  Eraser,
  RefreshCw,
  ChevronDown,
  Copy,
  Check,
  FileDown,
  Loader2
} from 'lucide-react';
import SignaturePad from 'react-signature-canvas';
import { ConfirmModal } from '../components/ConfirmModal';
import { WebcamModal } from '../components/WebcamModal';

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
};

const StatusTimeline: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();
  const steps = [
    { key: 'pending', label: t('status_pending'), icon: Clock },
    { key: 'accepted', label: t('status_accepted'), icon: CheckCircle2 },
    { key: 'completed', label: t('status_completed'), icon: Package }
  ];

  const currentIdx = steps.findIndex(s => s.key === status);
  const isCancelled = status === 'cancelled' || status === 'cancel_pending';
  
  // Calculate progress bar width
  const progressWidth = isCancelled ? 0 : (currentIdx / (steps.length - 1)) * 100;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm mb-6">
      <div className="relative">
        {/* Status Pipeline Line */}
        <div className="absolute top-[18px] left-[30px] right-[30px] sm:left-[40px] sm:right-[40px] h-0.5 bg-slate-100 z-0">
          {!isCancelled && (
            <div 
              className="h-full bg-primary transition-all duration-700 ease-in-out"
              style={{ width: `${progressWidth}%` }}
            />
          )}
        </div>

        <div className="relative flex items-center justify-between z-10 px-1 sm:px-2">
          {steps.map((step, idx) => {
          const isActive = idx <= currentIdx && !isCancelled;
          const isCurrent = idx === currentIdx && !isCancelled;
          const Icon = step.icon;
          
          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center gap-2 sm:gap-3">
              <div className={clsx(
                "w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-500 border-2",
                isActive 
                  ? "bg-primary border-primary text-white scale-110 shadow-lg shadow-primary/20" 
                  : "bg-white border-slate-100 text-slate-300",
                isCurrent && "ring-4 ring-primary/10"
              )}>
                <Icon className={clsx("w-4 h-4 sm:w-5 sm:h-5", isCurrent && "animate-pulse")} />
              </div>
              <div className="flex flex-col items-center">
                <span className={clsx(
                  "text-[10px] font-bold uppercase tracking-wider text-center",
                  isActive ? "text-primary font-black" : "text-slate-400"
                )}>
                  {step.label}
                </span>
                {isCurrent && (
                  <span className="text-[8px] font-bold text-primary animate-bounce mt-1">
                    {t('current_status')}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>
      {isCancelled && (
        <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold flex items-center gap-3 border border-red-100 animate-in fade-in slide-in-from-top-2">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="uppercase tracking-wider text-[10px] text-red-400 mb-0.5">{t('status_update')}</p>
            <p className="text-sm font-bold leading-none">
              {status === 'cancel_pending' ? t('status_cancel_pending') : t('status_cancelled')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export const JobReport: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const copyFromId = searchParams.get('copyFrom');
  const navigate = useNavigate();
  const userRole = localStorage.getItem('user_role') || 'customer';
  const isAdmin = userRole.toLowerCase() === 'administrator' || userRole.toLowerCase() === 'admin';

  const [cars, setCars] = useState<Car[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [customers, setCustomers] = useState<CustomerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [webcamType, setWebcamType] = useState<'pickup' | 'delivery' | 'document' | null>(null);
  const isMobile = useMemo(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent), []);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showRouteCompleteConfirm, setShowRouteCompleteConfirm] = useState(false);
  const [completingRouteIndex, setCompletingRouteIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [originalCustomerAndCar, setOriginalCustomerAndCar] = useState<{customerId: string, carId: string} | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const signaturePadRef = useRef<SignaturePad>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [webcamTarget, setWebcamTarget] = useState<'pickup' | 'delivery' | 'document' | null>(null);
  const [showScheduling, setShowScheduling] = useState(false);

  const [formData, setFormData] = useState({
    job_type: 'one_way' as 'one_way' | 'round_trip',
    work_date: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm
    advance_opening_time: '',
    notify_driver_24h_before: false,
    customer_name: '',
    customer_contact_name: '',
    customer_contact_phone: '',
    origin: '',
    origin_url: '',
    origin_lat: undefined as number | undefined,
    origin_lng: undefined as number | undefined,
    destination: '',
    destination_url: '',
    destination_lat: undefined as number | undefined,
    destination_lng: undefined as number | undefined,
    waypoints: [] as { name: string, url: string, lat?: number, lng?: number }[],
    routes: [
      {
        type: 'outbound' as 'outbound' | 'return',
        status: 'pending' as 'pending' | 'completed',
        date: new Date().toISOString().slice(0, 10),
        standby_time: '',
        departure_time: '',
        arrival_time: '',
        mileage_start: '',
        mileage_end: '',
        pickups: [{ name: '', url: '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }],
        deliveries: [{ name: '', url: '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }],
        distance: undefined as number | undefined,
        // Legacy fields for backward compatibility
        origin: '',
        origin_url: '',
        origin_lat: undefined as number | undefined,
        origin_lng: undefined as number | undefined,
        destination: '',
        destination_url: '',
        destination_lat: undefined as number | undefined,
        destination_lng: undefined as number | undefined,
        route_type: undefined as string | undefined
      }
    ],
    estimated_distance: undefined as number | undefined,
    vehicle_type: '',
    car_id: '',
    member_id: '',
    customer_id: '',
    phone: '',
    standby_time: '',
    departure_time: '',
    arrival_time: '',
    mileage_start: '',
    mileage_end: '',
    notes: '',
    status: 'pending' as 'pending' | 'accepted' | 'cancelled' | 'completed' | 'cancel_pending',
    cancel_reason: '',
    status_logs: [] as any[],
    signature: '' as string,
    signature_name: '' as string,
    photo_metadata: [] as any[],
    case_number: '',
    toll_fee: '' as string | number,
    fuel_cost: '' as string | number,
    other_expenses: '' as string | number,
    other_expenses_note: '',
    expense_items: [] as ExpenseItem[],
    current_mileage: undefined as number | undefined,
    next_maintenance_date: undefined as string | undefined,
    next_maintenance_mileage: undefined as number | undefined,
    deadline_value: '15' as string | number,
    deadline_unit: 'minutes' as 'minutes' | 'hours',
    acceptance_deadline: undefined as string | undefined,
    accepted_at: undefined as string | undefined,
  });

  const [allReports, setAllReports] = useState<any[]>([]);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [isJobOverdue, setIsJobOverdue] = useState(false);
  const [isUpdatingRouteStatus, setIsUpdatingRouteStatus] = useState(false);

  const handleCompleteRoute = (index: number) => {
    setCompletingRouteIndex(index);
    setShowRouteCompleteConfirm(true);
  };

  const confirmCompleteRoute = async () => {
    if (completingRouteIndex === null || !id || isUpdatingRouteStatus) return;
    
    const routeIndex = completingRouteIndex;
    setShowRouteCompleteConfirm(false);
    setIsUpdatingRouteStatus(true);
    try {
      const newRoutes = [...formData.routes];
      const route = newRoutes[routeIndex];

      // Upload point-specific photos if any
      // Pre-upload pickups photos
      for (let pIdx = 0; pIdx < (route.pickups || []).length; pIdx++) {
        const key = `r-${routeIndex}-p-${pIdx}`;
        const photosToUpload = pointPhotosMap[key] || [];
        if (photosToUpload.length > 0) {
          const uploadedIds = [];
          for (const p of photosToUpload) {
            const fileId = await directusApi.uploadFile(p.file);
            uploadedIds.push(fileId);
          }
          const currentPhotos = route.pickups[pIdx].photos || [];
          route.pickups[pIdx].photos = [...currentPhotos, ...uploadedIds];
          
          // Clear local photos after successful upload
          setPointPhotosMap(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
      }

      // Pre-upload deliveries photos
      for (let dIdx = 0; dIdx < (route.deliveries || []).length; dIdx++) {
        const key = `r-${routeIndex}-d-${dIdx}`;
        const photosToUpload = pointPhotosMap[key] || [];
        if (photosToUpload.length > 0) {
          const uploadedIds = [];
          for (const p of photosToUpload) {
            const fileId = await directusApi.uploadFile(p.file);
            uploadedIds.push(fileId);
          }
          const currentPhotos = route.deliveries[dIdx].photos || [];
          route.deliveries[dIdx].photos = [...currentPhotos, ...uploadedIds];

          // Clear local photos after successful upload
          setPointPhotosMap(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
      }

      newRoutes[routeIndex].status = 'completed';
      
      // Update local state first
      setFormData(prev => ({ ...prev, routes: newRoutes }));
      
      // Update database
      await directusApi.updateWorkReport(id, { routes: newRoutes });
      
      // Send notification specifically for this route
      await sendRouteCompletionNotification(routeIndex);
      
      setStatusConfig({
        type: 'success',
        title: t('success'),
        message: t('additional_work_saved_msg')
      });
      setShowStatusModal(true);
    } catch (err: any) {
      console.error('Error completing route:', err);
      setError(t('save_error')); 
    } finally {
      setIsUpdatingRouteStatus(false);
    }
  };

  const sendRouteCompletionNotification = async (routeIndex: number) => {
    try {
      const currentCustomerId = typeof formData.customer_id === 'object' && formData.customer_id ? (formData.customer_id as any).id : formData.customer_id;
      const currentCarId = typeof formData.car_id === 'object' && formData.car_id ? (formData.car_id as any).id : formData.car_id;
      const currentMemberId = typeof formData.member_id === 'object' && formData.member_id ? (formData.member_id as any).id : formData.member_id;

      if (!currentCustomerId) return;

      const customerLoc = customers.find(c => String(c.id) === String(currentCustomerId));
      if (!customerLoc) return;
      
      const memberIds = getCustomerMemberIds(customerLoc);
      if (memberIds.length === 0) return;

      const selectedCar = cars.find(c => String(c.id) === String(currentCarId));
      const driver = members.find(m => String(m.id) === String(currentMemberId));
      
      const statusText = t('route_delivered_notification', { number: routeIndex + 1 });
      const statusColor = '#27ae60'; // Green
      const displayId = formData.case_number || id;

      for (const memberId of memberIds) {
        try {
          const member = members.find(m => String(m.id) === String(memberId));
          if (!member) continue;

          const customerLineId = resolveLineUserId(member.line_user_id);
          if (!customerLineId) continue;

          const flexContents = generateCustomerFlexMessage(
            t('job_status_notification'),
            statusText,
            statusColor,
            {
              case_number: String(formData.case_number || id || 'N/A'),
              customer_name: String(formData.customer_name || '-'),
              origin: String(formData.origin || '-'),
              destination: String(formData.destination || '-'),
              routes: formData.routes,
              car_number: String(selectedCar?.car_number || 'N/A'),
              driver_name: String(driver ? `${driver.first_name} ${driver.last_name}` : '-'),
              driver_phone: String(driver?.phone || '-'),
              report_id: id
            },
            'completed'
          );

          await sendLineNotification(customerLineId, [{ type: "flex", altText: statusText, contents: flexContents }], statusText);
        } catch (memberErr: any) {
          console.error(`Failed to send LINE notification for route completion to member ${memberId}:`, memberErr);
        }
      }
    } catch (error) {
      console.error('Error in sendRouteCompletionNotification:', error);
    }
  };

  const handleSearchLocation = async (type: 'origin' | 'destination' | 'route_origin' | 'route_destination', routeIndex?: number) => {
    let query = '';
    if (type === 'origin') query = formData.origin;
    else if (type === 'destination') query = formData.destination;
    else if (type === 'route_origin' && routeIndex !== undefined) query = formData.routes[routeIndex].origin;
    else if (type === 'route_destination' && routeIndex !== undefined) query = formData.routes[routeIndex].destination;

    if (!query) {
      setStatusConfig({
        type: 'error',
        title: t('error'),
        message: t('search_location_placeholder')
      });
      setShowStatusModal(true);
      return;
    }

    try {
      const response = await axios.get(`/api/search-location?q=${encodeURIComponent(query)}`);
      if (response.data) {
        if (type === 'origin' || type === 'destination') {
          setFormData(prev => ({
            ...prev,
            [type === 'origin' ? 'origin_lat' : 'destination_lat']: response.data.lat,
            [type === 'origin' ? 'origin_lng' : 'destination_lng']: response.data.lng
          }));
        } else if (routeIndex !== undefined) {
          setFormData(prev => {
            const newRoutes = [...prev.routes];
            if (type === 'route_origin') {
              newRoutes[routeIndex] = {
                ...newRoutes[routeIndex],
                origin_lat: response.data.lat,
                origin_lng: response.data.lng
              };
            } else {
              newRoutes[routeIndex] = {
                ...newRoutes[routeIndex],
                destination_lat: response.data.lat,
                destination_lng: response.data.lng
              };
            }
            return { ...prev, routes: newRoutes };
          });
        }
        
        setStatusConfig({
          type: 'success',
          title: t('success'),
          message: t('location_found', { location: response.data.display_name })
        });
        setShowStatusModal(true);
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Clear auth and redirect
        localStorage.removeItem('admin_token');
        window.location.href = '/login';
        return;
      }
      console.error('Search location error:', error);
      setStatusConfig({
        type: 'error',
        title: t('error'),
        message: t('location_not_found')
      });
      setShowStatusModal(true);
    }
  };

  const handleAddExpense = () => {
    setFormData(prev => ({
      ...prev,
      expense_items: [
        ...(prev.expense_items || []),
        { id: Math.random().toString(36).substring(2, 11), name: '', amount: 0 }
      ]
    }));
  };

  const handleUpdateExpense = (itemId: string, field: 'name' | 'amount', value: string) => {
    setFormData(prev => ({
      ...prev,
      expense_items: (prev.expense_items || []).map(item => 
        item.id === itemId ? { ...item, [field]: field === 'amount' ? (value === '' ? 0 : parseFloat(value)) : value } : item
      )
    }));
  };

  const handleRemoveExpense = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      expense_items: (prev.expense_items || []).filter(item => item.id !== itemId)
    }));
  };

  const totalExpenses = useMemo(() => {
    return (formData.expense_items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [formData.expense_items]);

  const handleCalculateRouteDistance = async (index: number) => {
    setIsCalculatingDistance(true);
    try {
      const newRoutes = [...formData.routes];
      const route = newRoutes[index];
      
      const points = [
        ...(route.pickups || []).filter(p => p.url),
        ...(route.deliveries || []).filter(d => d.url)
      ];

      if (points.length < 2) {
        if (route.origin_url && route.destination_url) {
          points.push({ name: route.origin || '', url: route.origin_url, contact_name: '', contact_phone: '', time: '', photos: [] as string[] });
          points.push({ name: route.destination || '', url: route.destination_url, contact_name: '', contact_phone: '', time: '', photos: [] as string[] });
        } else {
          throw new Error(t('route_points_error', { index: index + 1 }));
        }
      }

      const uniquePoints = points.filter((p, i) => i === 0 || p.url !== points[i - 1].url);

      if (uniquePoints.length >= 2) {
        const response = await axios.post('/api/calculate-distance', {
          originUrl: uniquePoints[0].url,
          destinationUrl: uniquePoints[uniquePoints.length - 1].url,
          waypointUrls: uniquePoints.slice(1, -1).map(p => p.url),
          apiKey: localStorage.getItem('google_maps_api_key')
        });
        
        if (response.data && response.data.distance !== undefined) {
          const dist = Math.round(response.data.distance * 10) / 10;
          newRoutes[index] = {
            ...route,
            distance: dist,
            route_type: dist > 250 ? 'upcountry' : 'bangkok_vicinity'
          };
          
          // Recalculate total estimated distance
          const total = newRoutes.reduce((sum, r) => sum + (r.distance || 0), 0);
          
          setFormData(prev => ({
            ...prev,
            routes: newRoutes,
            estimated_distance: Math.round(total * 10) / 10
          }));

          setStatusConfig({
            type: 'success',
            title: t('success'),
            message: t('route_optimize_success', { distance: dist })
          });
          setShowStatusModal(true);
        } else {
          throw new Error(t('route_calc_failed', { index: index + 1 }));
        }
      }
    } catch (error: any) {
      console.error('Calculate individual route distance error:', error);
      const errorMessage = error.response?.data?.error || error.message || t('calculate_distance_error');
      setStatusConfig({
        type: 'error',
        title: t('error'),
        message: errorMessage
      });
      setShowStatusModal(true);
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  const handleCalculateDistance = async () => {
    setIsCalculatingDistance(true);
    try {
      const newRoutes = [...formData.routes];
      let totalDistance = 0;

      for (let i = 0; i < newRoutes.length; i++) {
        const route = newRoutes[i];
        let routeDistance = 0;
        
        // Collect all points in order: pickups then deliveries
        const points = [
          ...(route.pickups || []).filter(p => p.url),
          ...(route.deliveries || []).filter(d => d.url)
        ];

        if (points.length < 2) {
          // Fallback to legacy origin/destination if pickups/deliveries not used
          if (route.origin_url && route.destination_url) {
            points.push({ name: route.origin || '', url: route.origin_url, contact_name: '', contact_phone: '', time: '', photos: [] as string[] });
            points.push({ name: route.destination || '', url: route.destination_url, contact_name: '', contact_phone: '', time: '', photos: [] as string[] });
          } else {
            throw new Error(t('route_points_error', { index: i + 1 }));
          }
        }

        // Filter out consecutive duplicate URLs
        const uniquePoints = points.filter((p, index) => index === 0 || p.url !== points[index - 1].url);

        if (uniquePoints.length >= 2) {
          try {
            const response = await axios.post('/api/calculate-distance', {
              originUrl: uniquePoints[0].url,
              destinationUrl: uniquePoints[uniquePoints.length - 1].url,
              waypointUrls: uniquePoints.slice(1, -1).map(p => p.url),
              apiKey: localStorage.getItem('google_maps_api_key')
            });
            
            if (response.data && response.data.distance !== undefined) {
              routeDistance = response.data.distance;
            } else {
              throw new Error(t('route_calc_failed', { index: i + 1 }));
            }
          } catch (urlErr: any) {
            console.error(`URL calculation failed for route ${i+1}:`, urlErr);
            throw urlErr;
          }
        }

        const dist = Math.round(routeDistance * 10) / 10;
        newRoutes[i] = {
          ...route,
          distance: dist,
          route_type: dist > 250 ? 'upcountry' : 'bangkok_vicinity'
        };
        totalDistance += dist;
      }

      const finalDistance = Math.round(totalDistance * 10) / 10;
      
      // Sync first route to top-level fields for compatibility
      const firstRoute = newRoutes[0];
      const firstPickup = firstRoute.pickups?.[0] || { name: firstRoute.origin, url: firstRoute.origin_url };
      const lastDelivery = firstRoute.deliveries?.[firstRoute.deliveries.length - 1] || { name: firstRoute.destination, url: firstRoute.destination_url };
      
      setFormData(prev => ({
        ...prev,
        routes: newRoutes,
        estimated_distance: finalDistance,
        origin: firstPickup.name || '',
        origin_url: firstPickup.url || '',
        destination: lastDelivery.name || '',
        destination_url: lastDelivery.url || ''
      }));

      setStatusConfig({
        type: 'success',
        title: t('success'),
        message: t('calculate_distance_success', { distance: finalDistance })
      });
      setShowStatusModal(true);
    } catch (error: any) {
      console.error('Calculate distance error:', error);
      const errorMessage = error.response?.data?.error || error.message || t('calculate_distance_error');
      
      let displayMessage = errorMessage;
      if (errorMessage === 'Location not found') {
        displayMessage = t('location_not_found_error');
      } else if (errorMessage === 'Network Error' || errorMessage.includes('Network Error')) {
        displayMessage = t('network_error');
      }

      setStatusConfig({
        type: 'error',
        title: t('error'),
        message: displayMessage
      });
      setShowStatusModal(true);
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  const handleOptimizeRoute = async () => {
    setIsCalculatingDistance(true);
    try {
      const newRoutes = [...formData.routes];
      let totalDistance = 0;

      for (let i = 0; i < newRoutes.length; i++) {
        const route = newRoutes[i];
        
        // Collect all points
        const pickups = [...(route.pickups || [])].filter(p => p.url);
        const deliveries = [...(route.deliveries || [])].filter(d => d.url);
        
        const allPoints = [...pickups, ...deliveries];

        if (allPoints.length < 3) {
          // If only 2 points, just calculate distance normally
          const response = await axios.post('/api/calculate-distance', {
            originUrl: allPoints[0].url,
            destinationUrl: allPoints[allPoints.length - 1].url,
            waypointUrls: [],
            apiKey: localStorage.getItem('google_maps_api_key')
          });
          newRoutes[i] = { ...route, distance: response.data.distance };
          totalDistance += response.data.distance;
          continue;
        }

        // Keep first pickup as start and last delivery as end
        const origin = allPoints[0];
        const destination = allPoints[allPoints.length - 1];
        const waypoints = allPoints.slice(1, -1);

        const response = await axios.post('/api/calculate-distance', {
          originUrl: origin.url,
          destinationUrl: destination.url,
          waypointUrls: waypoints.map(w => w.url),
          optimize: true,
          apiKey: localStorage.getItem('google_maps_api_key')
        });

        if (response.data && response.data.status === 'OK' && response.data.optimizedOrder) {
          const order = response.data.optimizedOrder; // Array of indices of waypoints
          const optimizedWaypoints = order.map((idx: number) => waypoints[idx]);
          
          // Re-distribute back to pickups and deliveries while maintaining the optimized sequence
          // We'll put all optimized waypoints that were originally pickups into pickups, 
          // and those that were deliveries into deliveries, but in the new order.
          const finalPickups = [origin];
          const finalDeliveries = [];
          
          optimizedWaypoints.forEach((wp: any) => {
            const wasPickup = pickups.some(p => p.url === wp.url && p !== origin);
            if (wasPickup) {
              finalPickups.push(wp);
            } else {
              finalDeliveries.push(wp);
            }
          });
          finalDeliveries.push(destination);

          newRoutes[i] = {
            ...route,
            pickups: finalPickups,
            deliveries: finalDeliveries,
            distance: response.data.distance,
            route_type: response.data.distance > 250 ? 'upcountry' : 'bangkok_vicinity'
          };
          totalDistance += response.data.distance;
        } else {
          // Fallback or no optimization available
          newRoutes[i] = { ...route, distance: response.data.distance };
          totalDistance += response.data.distance;
        }
      }

      const finalDistance = Math.round(totalDistance * 10) / 10;
      
      setFormData(prev => ({
        ...prev,
        routes: newRoutes,
        estimated_distance: finalDistance
      }));

      setStatusConfig({
        type: 'success',
        title: t('success'),
        message: t('route_optimize_success', { distance: finalDistance })
      });
      setShowStatusModal(true);
    } catch (error: any) {
      console.error('Optimize route error:', error);
      setStatusConfig({
        type: 'error',
        title: t('error'),
        message: error.response?.data?.error || error.message || t('route_optimize_error')
      });
      setShowStatusModal(true);
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  const busyMembersMap = useMemo(() => {
    const map = new Set<string>();
    allReports.forEach(r => {
      const status = r.status;
      if (!['completed', 'cancelled'].includes(status)) {
        const memberId = (typeof r.member_id === 'object' ? r.member_id?.id : r.member_id) || 
                         (typeof r.driver_id === 'object' ? r.driver_id?.id : r.driver_id);
        if (memberId && String(r.id) !== String(id)) {
          map.add(String(memberId));
        }
      }
    });
    return map;
  }, [allReports, id]);

  const lastMileageMap = useMemo(() => {
    const mileageMap = new Map<string, number>();
    const driverMap = new Map<string, string>();
    
    // Group reports by car
    const carReportsMap = new Map<string, any[]>();
    allReports.forEach(r => {
      // Include all reports that are not cancelled to find the most recent driver
      if (r.status !== 'cancelled' && r.status !== 'cancel_pending') {
        const carId = typeof r.car_id === 'object' ? r.car_id?.id : r.car_id;
        if (carId) {
          const reports = carReportsMap.get(String(carId)) || [];
          reports.push(r);
          carReportsMap.set(String(carId), reports);
        }
      }
    });

    // For each car, find the latest report
    carReportsMap.forEach((reports, carId) => {
      const sorted = reports.sort((a, b) => {
        const dateA = new Date(a.arrival_time || a.date_created || 0).getTime();
        const dateB = new Date(b.arrival_time || b.date_created || 0).getTime();
        return dateB - dateA;
      });
      const latestReport = sorted[0];
      
      // Mileage should only come from completed reports for accuracy
      const latestCompleted = sorted.find(r => r.status === 'completed');
      if (latestCompleted) {
        mileageMap.set(carId, latestCompleted.mileage_end || 0);
      } else {
        mileageMap.set(carId, 0);
      }
      
      const lastDriverId = (typeof latestReport.member_id === 'object' ? latestReport.member_id?.id : latestReport.member_id) || 
                          (typeof latestReport.driver_id === 'object' ? latestReport.driver_id?.id : latestReport.driver_id);
      if (lastDriverId) {
        driverMap.set(carId, String(lastDriverId));
      }
    });
    return { mileageMap, driverMap };
  }, [allReports]);

  const lastDriverMap = lastMileageMap.driverMap;
  const actualMileageMap = lastMileageMap.mileageMap;

  const isMemberBusy = useCallback((memberId: string) => {
    return busyMembersMap.has(String(memberId));
  }, [busyMembersMap]);

  const getLastMileage = useCallback((carId: string) => {
    return actualMileageMap.get(String(carId)) || 0;
  }, [actualMileageMap]);

  const getLastDriver = useCallback((carId: string) => {
    return lastDriverMap.get(String(carId)) || null;
  }, [lastDriverMap]);

  const resolveMemberId = (idOrUid: any) => {
    if (!idOrUid || idOrUid === 'null' || idOrUid === 'undefined' || idOrUid === '') return null;
    const idStr = String(idOrUid);
    
    // Try to find by Directus ID first
    let member = members.find(m => String(m.id) === idStr);
    if (member) return String(member.id);
    
    // If not found, try to find by LINE UID
    member = members.find(m => String(m.line_user_id) === idStr);
    if (member) return String(member.id);

    // Try to find by display_name as a last resort (sometimes users use it as ID)
    member = members.find(m => m.display_name && String(m.display_name) === idStr);
    if (member) return String(member.id);
    
    if (members.length > 0) {
      console.warn(`resolveMemberId: Could not find member for "${idStr}" in ${members.length} loaded members. Returning original.`);
    }
    
    return idStr; // Fallback to original
  };

  const resolveLineUserId = (lineIdRaw: any): string | null => {
    if (!lineIdRaw) return null;
    if (typeof lineIdRaw === 'object') {
      return (lineIdRaw as any).line_user_id || (lineIdRaw as any).id || null;
    }
    return String(lineIdRaw);
  };

  const formatFlexDateTime = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      // Handle HH:mm format (old) vs YYYY-MM-DDTHH:mm (new)
      if (isoStr.length === 5 && isoStr.includes(':')) {
        return isoStr;
      }
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return isoStr;
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear() + 543; // Thai Year (optional choice for Thai apps, I'll go with full year)
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      // Use standard Gregorian year if preferred or Thai year if user expects Buddhist Era
      // Most corporate apps in Thailand use BE (Buddhist Era) +543
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
      return isoStr;
    }
  };

  const getCustomerMemberIds = (customerLoc: any): string[] => {
    if (!customerLoc) return [];
    const memberIds: string[] = [];
    
    // 1. Primary member link
    const primaryId = typeof customerLoc.member_id === 'object' ? customerLoc.member_id?.id : customerLoc.member_id;
    if (primaryId && !memberIds.includes(String(primaryId))) {
      memberIds.push(String(primaryId));
    }

    // 2. Members from the group
    if (customerLoc.members && Array.isArray(customerLoc.members)) {
      customerLoc.members.forEach((m: any) => {
        const mMember = typeof m.line_user_id === 'object' ? m.line_user_id : 
                        (typeof m.members_id === 'object' ? m.members_id : 
                        (typeof m.line_users_id === 'object' ? m.line_users_id : null));
        
        const mIdRaw = mMember ? mMember.id : (m.line_users_id || m.line_user_id || m.members_id);
        const mid = resolveMemberId(mIdRaw);
        if (mid && !memberIds.includes(String(mid))) {
          memberIds.push(String(mid));
        }
      });
    }

    return memberIds;
  };

  const totalDistance = useMemo(() => {
    return formData.routes.reduce((acc, route) => {
      const start = parseFloat(route.mileage_start || '0');
      const end = parseFloat(route.mileage_end || '0');
      if (!isNaN(start) && !isNaN(end)) {
        return acc + (end - start);
      }
      return acc;
    }, 0);
  }, [formData.routes]);

  const filteredCars = useMemo(() => {
    const memberId = localStorage.getItem('member_id');
    const userRole = localStorage.getItem('user_role');
    
    let baseCars = cars;

    // Admin sees all cars, but we prioritize/filter if a customer is selected
    if (isAdmin) {
      if (formData.customer_name) {
        const selectedCustomerLoc = customers.find(c => c.company_name === formData.customer_name);
        if (selectedCustomerLoc) {
          const matchingMember = members.find(m => 
            m.role === 'customer' && 
            (
              (m.email && selectedCustomerLoc.email && m.email.toLowerCase() === selectedCustomerLoc.email.toLowerCase()) ||
              (m.phone && selectedCustomerLoc.phone && m.phone.replace(/\D/g, '') === selectedCustomerLoc.phone.replace(/\D/g, '')) ||
              (selectedCustomerLoc.company_name.toLowerCase().includes(m.first_name.toLowerCase()) && m.first_name.length > 2)
            )
          );
          
          if (matchingMember) {
            const assignedCars = cars.filter(car => 
              car.car_users?.some((cu: any) => {
                const cuId = typeof cu.line_user_id === 'object' ? cu.line_user_id.id : cu.line_user_id;
                return String(cuId) === String(matchingMember.id);
              })
            );
            // If we found assigned cars, show them. Otherwise show all.
            if (assignedCars.length > 0) {
              baseCars = assignedCars;
            }
          }
        }
      }
    } else if (userRole === 'customer' && memberId) {
      // Customers only see cars assigned to them
      baseCars = cars.filter(car => 
        car.car_users?.some((cu: any) => {
          const cuId = typeof cu.line_user_id === 'object' ? cu.line_user_id.id : cu.line_user_id;
          return String(cuId) === String(memberId);
        })
      );
    }

    // Apply Queue Logic if estimated_distance is set AND queue system is enabled
    const isQueueSystemEnabled = localStorage.getItem('enable_queue_system') !== 'false';
    const bkkMaxDistance = parseInt(localStorage.getItem('bkk_max_distance') || '250', 10);
    
    if (isQueueSystemEnabled) {
      const carsWithQueue = baseCars.map(car => {
        const carReports = allReports.filter(r => {
          const reportCarId = typeof r.car_id === 'object' ? r.car_id?.id : r.car_id;
          return reportCarId === car.id && r.status !== 'deleted' && r.status !== 'cancelled';
        });

        let count_bkk = 0;
        let count_upcountry = 0;

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

        return { ...car, _queue: { priority_score, recommendation, count_bkk, count_upcountry } };
      });

      if (formData.estimated_distance !== undefined && formData.estimated_distance > 0) {
        const isUpcountry = formData.estimated_distance > bkkMaxDistance;
        
        // Sort based on queue
        if (isUpcountry) {
          // For upcountry, higher priority score (more BKK jobs) goes first
          carsWithQueue.sort((a, b) => b._queue.priority_score - a._queue.priority_score);
          
          // Filter to only show recommended ones if there are any
          const recommended = carsWithQueue.filter(c => c._queue.recommendation === 'upcountry');
          if (recommended.length > 0) {
            return recommended;
          }
        } else {
          // For BKK, lower priority score (more upcountry jobs) goes first
          carsWithQueue.sort((a, b) => a._queue.priority_score - b._queue.priority_score);
          
          // Filter to only show recommended ones if there are any
          const recommended = carsWithQueue.filter(c => c._queue.recommendation === 'bkk');
          if (recommended.length > 0) {
            return recommended;
          }
        }
      }
      
      return carsWithQueue;
    }
    
    return baseCars;
  }, [cars, isAdmin, formData.customer_name, customers, members, formData.estimated_distance, allReports]);
  const sortedMembers = useMemo(() => {
    const driverMembers = members.filter(m => m.role === 'member' || m.role === 'driver');
    
    if (!formData.car_id) return driverMembers;
    
    const selectedCar = cars.find(c => String(c.id) === String(typeof formData.car_id === 'object' ? (formData.car_id as any)?.id : formData.car_id));
    if (!selectedCar || !selectedCar.car_users) return driverMembers;

    const linkedMemberIds = selectedCar.car_users
      .map((cu: any) => {
        const user = cu.line_user_id;
        return user && typeof user === 'object' ? String(user.id) : String(user);
      })
      .filter(Boolean);

    return [...driverMembers].sort((a, b) => {
      const aLinked = linkedMemberIds.includes(String(a.id));
      const bLinked = linkedMemberIds.includes(String(b.id));
      if (aLinked && !bLinked) return -1;
      if (!aLinked && bLinked) return 1;
      return 0;
    });
  }, [members, formData.car_id, cars]);

  const [statusConfig, setStatusConfig] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
    action?: () => void;
  }>({ type: 'success', title: '', message: '' });
  
  // Separate photo states
  const [pickupPhotos, setPickupPhotos] = useState<{file: File, metadata: any, preview: string}[]>([]);
  const [deliveryPhotos, setDeliveryPhotos] = useState<{file: File, metadata: any, preview: string}[]>([]);
  const [documentPhotos, setDocumentPhotos] = useState<{file: File, metadata: any, preview: string}[]>([]);
  
  // New state for point-specific photos (per route point)
  const [pointPhotosMap, setPointPhotosMap] = useState<Record<string, {file: File, metadata: any, preview: string}[]>>({});
  
  const removeExistingPhoto = (index: number, type: 'pickup' | 'delivery' | 'document') => {
    if (type === 'pickup') {
      setExistingPickupPhotos(prev => prev.filter((_, i) => i !== index));
    } else if (type === 'delivery') {
      setExistingDeliveryPhotos(prev => prev.filter((_, i) => i !== index));
    } else {
      setExistingDocumentPhotos(prev => prev.filter((_, i) => i !== index));
    }
  };

  const removePointExistingPhoto = (routeIdx: number, pointIdx: number, photoIdx: number, pointType: 'pickup' | 'delivery') => {
    setFormData(prev => {
      const newRoutes = [...prev.routes];
      const point = pointType === 'pickup' 
        ? newRoutes[routeIdx].pickups[pointIdx] 
        : newRoutes[routeIdx].deliveries[pointIdx];
      
      if (point && point.photos) {
        point.photos = (point.photos as string[]).filter((_, i) => i !== photoIdx);
      }
      
      return { ...prev, routes: newRoutes };
    });
  };

  const renderPhotoSection = (
    title: string, 
    photos: {file: File, metadata: any, preview: string}[], 
    existingPhotos: string[],
    type: string,
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void,
    onRemove: (index: number) => void,
    onRemoveExisting: (index: number) => void,
    isProcessing?: boolean,
    idPrefix: string = 'global'
  ) => (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-3 border-b border-slate-200 bg-white">
        <h4 className="text-sm font-bold text-slate-700 text-center">{title}</h4>
      </div>
      
      <div className="p-3 flex-1 space-y-3">
        {/* Gallery Grid */}
        <div className="grid grid-cols-2 gap-2">
          {existingPhotos.map((fileId, i) => (
            <div key={`existing-${i}`} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
              <img 
                src={directusApi.getFileUrl(fileId, { key: 'system-large-contain' })} 
                alt="existing" 
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setFullscreenImage(directusApi.getFileUrl(fileId))}
              />
              <button 
                type="button"
                onClick={() => onRemoveExisting(i)} 
                className="absolute top-1 right-1 bg-red-500/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {photos.map((p, i) => (
            <div key={`new-${i}`} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
              <img 
                src={p.preview} 
                alt="preview" 
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setFullscreenImage(p.preview)}
              />
              <button 
                type="button"
                onClick={() => onRemove(i)} 
                className="absolute top-1 right-1 bg-red-500/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Upload Buttons */}
        <div className="flex flex-col gap-2">
          {isProcessing ? (
            <div className="flex items-center justify-center py-4 bg-white rounded-xl border border-dashed border-slate-300">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <button 
                type="button"
                onClick={() => {
                  if (isMobile) {
                    document.getElementById(`camera-input-${idPrefix}-${type}`)?.click();
                  } else {
                    setWebcamType(type as any);
                    setShowWebcam(true);
                  }
                }}
                className="flex flex-col items-center justify-center gap-1 py-3 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100 active:scale-[0.98]"
              >
                <Camera className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{t('capture_photo')}</span>
                <input 
                  id={`camera-input-${idPrefix}-${type}`}
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  onChange={onUpload} 
                />
              </button>
              <label className="flex flex-col items-center justify-center gap-1 py-3 bg-slate-100 text-slate-600 rounded-xl cursor-pointer hover:bg-slate-200 transition-all border border-slate-200 active:scale-[0.98]">
                <Plus className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{t('upload_photo_btn')}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={onUpload} />
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
  
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [existingPickupPhotos, setExistingPickupPhotos] = useState<string[]>([]);
  const [existingDeliveryPhotos, setExistingDeliveryPhotos] = useState<string[]>([]);
  const [existingDocumentPhotos, setExistingDocumentPhotos] = useState<string[]>([]);
  const [initialValues, setInitialValues] = useState<any>({
    standby_time: '',
    departure_time: '',
    arrival_time: '',
    mileage_start: '',
    mileage_end: '',
    customer_contact_name: '',
    customer_contact_phone: ''
  });
  
  useEffect(() => {
    // No redirect needed here, permissions are handled by the backend
  }, [id, isAdmin, navigate]);

  const generateCaseNumber = (companyCode: string = 'TH', reports: any[] = allReports) => {
    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                    (now.getMonth() + 1).toString().padStart(2, '0') + 
                    now.getDate().toString().padStart(2, '0');
    
    const prefix = `${companyCode}${dateStr}`;
    
    // Find existing reports for this company and date to determine the running number
    const reportsToday = reports.filter(r => {
      return r.case_number && r.case_number.startsWith(prefix);
    });

    // Find the highest running number and increment it
    let maxRunning = 0;
    reportsToday.forEach(r => {
      const numStr = r.case_number.replace(prefix, '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxRunning) {
        maxRunning = num;
      }
    });

    const runningNumber = (maxRunning + 1).toString().padStart(3, '0');
    return `${prefix}${runningNumber}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const isAdminUser = localStorage.getItem('is_admin') === 'true';
        
        let carsData = [];
        let membersData = [];
        let customersData = [];
        let reportsData: any[] = [];

        try {
          const [c, m, cl, ar, settings] = await Promise.all([
            directusApi.getCars(),
            directusApi.getMembers(),
            directusApi.getCustomerLocations(),
            directusApi.getWorkReports(),
            directusApi.getSystemSettings()
          ]);
          carsData = c;
          membersData = m;
          customersData = cl;
          reportsData = ar;
          setAllReports(ar);

          if (settings && settings.expense_categories) {
            const cats = Array.isArray(settings.expense_categories) 
              ? settings.expense_categories 
              : (typeof settings.expense_categories === 'string' ? settings.expense_categories.split(',').filter(Boolean) : []);
            setExpenseCategories(cats);
          } else {
            // Fallback to localStorage if Directus fetch fails or is empty
            const localCats = (localStorage.getItem('expense_categories') || '').split(',').filter(Boolean);
            if (localCats.length > 0) setExpenseCategories(localCats);
          }
        } catch (fetchErr: any) {
          if (fetchErr.response?.status === 401) {
            // The axios interceptor will handle the redirect to login
            return;
          }
          console.error('Initial fetch error in JobReport:', fetchErr);
          // If members fail but user is admin, we might still want to see the form
          if (fetchErr.message?.includes('line_users')) {
            const [c, cl, ar] = await Promise.all([
              directusApi.getCars(),
              directusApi.getCustomerLocations(),
              directusApi.getWorkReports()
            ]);
            carsData = c;
            customersData = cl;
            reportsData = ar;
            setAllReports(ar);
          } else {
            throw fetchErr;
          }
        }

        setCars(carsData);
        console.log('DEBUG: membersData:', membersData);
        setMembers(membersData);
        setCustomers(customersData);
        console.log(`JobReport: Loaded ${membersData.length} members, ${customersData.length} customers, ${carsData.length} cars`);

        // Check LINE configuration
        try {
          const [configRes, timeRes] = await Promise.all([
            axios.get('/api/line/config-check'),
            axios.get('/api/time')
          ]);
          
          console.log('LINE Configuration Check:', configRes.data);
          if (!configRes.data.configured) {
            console.warn('LINE_CHANNEL_ACCESS_TOKEN is not configured in the backend.');
          }

          // If this is a new job (no id and no copyFromId), default the work_date to server time
          if (!id && !copyFromId && timeRes.data && timeRes.data.timestamp) {
            const serverDate = new Date(timeRes.data.timestamp);
            const formatted = serverDate.getFullYear() + '-' + 
                            String(serverDate.getMonth() + 1).padStart(2, '0') + '-' + 
                            String(serverDate.getDate()).padStart(2, '0') + 'T' + 
                            String(serverDate.getHours()).padStart(2, '0') + ':' + 
                            String(serverDate.getMinutes()).padStart(2, '0');
            
            setFormData(prev => ({ 
              ...prev, 
              work_date: formatted,
              routes: prev.routes.map(r => ({ ...r, date: formatted.slice(0, 10) }))
            }));
          }
        } catch (configErr: any) {
          if (configErr.response?.status === 401) return;
          console.error('Failed to check LINE configuration:', configErr);
        }

        if (id) {
          const report = await directusApi.getWorkReport(id);
          
          const formatTimeForInput = (isoString: string | null) => {
            if (!isoString) return '';
            try {
              const date = new Date(isoString);
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const hours = String(date.getHours()).padStart(2, '0');
              const minutes = String(date.getMinutes()).padStart(2, '0');
              return `${year}-${month}-${day}T${hours}:${minutes}`;
            } catch (e) {
              return '';
            }
          };

          const initialData = {
            job_type: (report.job_type as 'one_way' | 'round_trip') || 'one_way',
            work_date: formatTimeForInput(report.work_date || report.date_created),
            customer_name: report.customer_name || report.customer_id?.company_name || '',
            customer_contact_name: report.customer_contact_name || '',
            customer_contact_phone: report.customer_contact_phone || '',
            origin: report.origin || '',
            origin_url: report.origin_url || '',
            origin_lat: report.origin_lat,
            origin_lng: report.origin_lng,
            destination: report.destination || '',
            destination_url: report.destination_url || '',
            destination_lat: report.destination_lat,
            destination_lng: report.destination_lng,
            waypoints: report.waypoints || [],
            routes: (report.routes && report.routes.length > 0) 
              ? report.routes.map((r: any, idx: number) => ({ 
                  ...r, 
                  status: r.status || 'pending',
                  date: r.date || formatTimeForInput(report.work_date || report.date_created).slice(0, 10),
                  standby_time: formatTimeForInput(r.standby_time || (idx === 0 ? report.standby_time : '')),
                  departure_time: formatTimeForInput(r.departure_time || (idx === 0 ? report.departure_time : '')),
                  arrival_time: formatTimeForInput(r.arrival_time || (idx === report.routes.length - 1 ? report.arrival_time : '')),
                  mileage_start: (r.mileage_start !== null && r.mileage_start !== undefined) ? r.mileage_start.toString() : (idx === 0 && report.mileage_start !== null ? report.mileage_start.toString() : ''),
                  mileage_end: (r.mileage_end !== null && r.mileage_end !== undefined) ? r.mileage_end.toString() : (idx === report.routes.length - 1 && report.mileage_end !== null ? report.mileage_end.toString() : '')
                }))
              : [
              {
                type: 'outbound' as 'outbound' | 'return',
                status: 'pending' as 'pending' | 'completed',
                date: formatTimeForInput(report.work_date || report.date_created).slice(0, 10),
                standby_time: formatTimeForInput(report.standby_time),
                departure_time: formatTimeForInput(report.departure_time),
                arrival_time: formatTimeForInput(report.arrival_time),
                mileage_start: report.mileage_start !== null && report.mileage_start !== undefined ? report.mileage_start.toString() : '',
                mileage_end: report.mileage_end !== null && report.mileage_end !== undefined ? report.mileage_end.toString() : '',
                pickups: [{ name: '', url: '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }],
                deliveries: [{ name: '', url: '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }],
                origin: report.origin || '',
                origin_url: report.origin_url || '',
                origin_lat: report.origin_lat,
                origin_lng: report.origin_lng,
                destination: report.destination || '',
                destination_url: report.destination_url || '',
                destination_lat: report.destination_lat,
                destination_lng: report.destination_lng,
                distance: report.estimated_distance,
                route_type: report.estimated_distance > 250 ? 'upcountry' : 'bangkok_vicinity'
              }
            ],
            estimated_distance: report.estimated_distance,
            vehicle_type: report.vehicle_type || report.car_id?.vehicle_type || '',
            car_id: report.car_id?.id || report.car_id || '',
            member_id: report.member_id?.id || report.member_id || report.driver_id?.id || report.driver_id || '',
            customer_id: report.customer_id?.id || report.customer_id || '',
            phone: report.phone || '',
            standby_time: formatTimeForInput(report.standby_time),
            departure_time: formatTimeForInput(report.departure_time),
            arrival_time: formatTimeForInput(report.arrival_time),
            mileage_start: report.mileage_start !== null && report.mileage_start !== undefined ? report.mileage_start.toString() : '',
            mileage_end: report.mileage_end !== null && report.mileage_end !== undefined ? report.mileage_end.toString() : '',
            notes: report.notes || '',
            status: report.status || 'pending',
            cancel_reason: report.cancel_reason || '',
            status_logs: report.status_logs || [],
            signature: report.signature || '',
            signature_name: report.signature_name || '',
            photo_metadata: report.photo_metadata || [],
            case_number: report.case_number || '',
            toll_fee: report.toll_fee !== null && report.toll_fee !== undefined ? report.toll_fee.toString() : '',
            fuel_cost: report.fuel_cost !== null && report.fuel_cost !== undefined ? report.fuel_cost.toString() : '',
            other_expenses: report.other_expenses !== null && report.other_expenses !== undefined ? report.other_expenses.toString() : '',
            other_expenses_note: report.other_expenses_note || '',
            expense_items: Array.isArray(report.expense_items) ? report.expense_items : [],
            current_mileage: report.car_id?.current_mileage,
            next_maintenance_date: report.car_id?.next_maintenance_date,
            next_maintenance_mileage: report.car_id?.next_maintenance_mileage,
            deadline_value: '',
            deadline_unit: 'minutes' as 'minutes' | 'hours',
            acceptance_deadline: report.acceptance_deadline,
            accepted_at: report.accepted_at,
            advance_opening_time: formatTimeForInput(report.advance_opening_time),
            notify_driver_24h_before: report.notify_driver_24h_before || false
          };
          
          setFormData(initialData);
          setShowScheduling(!!report.advance_opening_time || !!report.notify_driver_24h_before);
          // Deep clone to prevent mutation issues when comparing in handleSubmit
          setInitialValues(JSON.parse(JSON.stringify(initialData)));
          setOriginalCustomerAndCar({
            customerId: String(initialData.customer_id),
            carId: String(initialData.car_id)
          });
          
          if (report.pickup_photos && Array.isArray(report.pickup_photos)) {
            const photoIds = report.pickup_photos.map((p: any) => typeof p === 'string' ? p : p.id);
            setExistingPickupPhotos(photoIds);
          }
          if (report.delivery_photos && Array.isArray(report.delivery_photos)) {
            const photoIds = report.delivery_photos.map((p: any) => typeof p === 'string' ? p : p.id);
            setExistingDeliveryPhotos(photoIds);
          }
          if (report.document_photos && Array.isArray(report.document_photos)) {
            const photoIds = report.document_photos.map((p: any) => typeof p === 'string' ? p : p.id);
            setExistingDocumentPhotos(photoIds);
          }
        } else if (copyFromId) {
          const report = await directusApi.getWorkReport(copyFromId);
          const newCaseNumber = generateCaseNumber('TH', reportsData);

          setFormData(prev => ({
            ...prev,
            case_number: newCaseNumber,
            job_type: (report.job_type as 'one_way' | 'round_trip') || 'one_way',
            customer_name: report.customer_name || report.customer_id?.company_name || '',
            customer_contact_name: report.customer_contact_name || '',
            customer_contact_phone: report.customer_contact_phone || '',
            origin: report.origin || '',
            origin_url: report.origin_url || '',
            origin_lat: report.origin_lat,
            origin_lng: report.origin_lng,
            destination: report.destination || '',
            destination_url: report.destination_url || '',
            destination_lat: report.destination_lat,
            destination_lng: report.destination_lng,
            waypoints: report.waypoints || [],
            routes: (report.routes && report.routes.length > 0) 
              ? report.routes.map((r: any) => ({ 
                  ...r, 
                  status: 'pending',
                  date: new Date().toISOString().slice(0, 10),
                  standby_time: '',
                  departure_time: '',
                  arrival_time: '',
                  mileage_start: '',
                  mileage_end: ''
                }))
              : prev.routes,
            estimated_distance: report.estimated_distance,
            vehicle_type: report.vehicle_type || report.car_id?.vehicle_type || '',
            car_id: report.car_id?.id || report.car_id || '',
            member_id: report.member_id?.id || report.member_id || report.driver_id?.id || report.driver_id || '',
            customer_id: report.customer_id?.id || report.customer_id || '',
            phone: report.phone || '',
            notes: report.notes || '',
            status: 'pending'
          }));
        } else {
          // Generate new case number for new reports
          const newCaseNumber = generateCaseNumber('TH', reportsData);
          
          if (!isAdmin) {
            // Pre-fill member_id for new reports if user is a member
            const memberId = localStorage.getItem('member_id');
            const userPhone = localStorage.getItem('user_phone');
            if (memberId) {
              const member = membersData.find(m => String(m.id) === String(memberId));
              const memberPhone = member?.phone || (member as any)?.Phone || (member as any)?.phone_number || userPhone || '';
              setFormData(prev => ({
                ...prev,
                case_number: newCaseNumber,
                member_id: memberId,
                phone: memberPhone || prev.phone
              }));
            } else {
              setFormData(prev => ({ ...prev, case_number: newCaseNumber }));
            }
          } else {
            setFormData(prev => ({ ...prev, case_number: newCaseNumber }));
          }
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          return;
        }
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isAdmin]);

  // Auto-fill last driver and mileage when car changes
  useEffect(() => {
    const currentCarId = typeof formData.car_id === 'object' ? (formData.car_id as any).id : formData.car_id;
    // If car is selected and no driver is selected yet (or we are admin and want to auto-fill)
    if (currentCarId && members.length > 0 && cars.length > 0) {
      // Auto-fill mileage_start when car changes
      const selectedCar = cars.find(c => String(c.id) === String(currentCarId));
      const lastMileage = selectedCar?.current_mileage || getLastMileage(currentCarId);
      
      if (lastMileage > 0) {
        // For new reports, always sync with car mileage when car changes
        // For existing reports, only fill if currently empty
        if (!id || (!formData.mileage_start || formData.mileage_start === '0' || formData.mileage_start === '')) {
          if (formData.mileage_start !== lastMileage.toString()) {
            setFormData(prev => ({
              ...prev,
              mileage_start: lastMileage.toString()
            }));
          }
        }
      }
      
      // Auto-fill driver based on car assignment
      if (currentCarId && (isAdmin || !formData.member_id)) {
        let autoFilledDriverId = null;
        
        // Priority 1: Static assignment in Car settings
        const selectedCar = cars.find(c => String(c.id) === String(currentCarId));
        if (selectedCar && selectedCar.car_users) {
          // Try to find a member with driver-like role first
          let driverMember = selectedCar.car_users.find((cu: any) => {
            const user = cu.line_user_id;
            const role = typeof user === 'object' ? user.role : '';
            return user && (role === 'member' || role === 'driver' || role === 'staff');
          })?.line_user_id;

          // Fallback: Find any member that is not a customer
          if (!driverMember) {
            driverMember = selectedCar.car_users.find((cu: any) => {
              const user = cu.line_user_id;
              const role = typeof user === 'object' ? user.role : '';
              return user && role !== 'customer';
            })?.line_user_id;
          }

          if (driverMember) {
            autoFilledDriverId = typeof driverMember === 'object' ? driverMember.id : driverMember;
          }
        }

        // Priority 1.5: Match by owner_name if car_users didn't work
        if (!autoFilledDriverId && selectedCar?.owner_name) {
          const ownerName = selectedCar.owner_name.trim().toLowerCase();
          const matchingMember = members.find(m => {
            const fullName = `${m.first_name} ${m.last_name}`.trim().toLowerCase();
            const displayName = (m.display_name || '').toLowerCase();
            return fullName === ownerName || 
                   displayName === ownerName || 
                   fullName.includes(ownerName) || 
                   ownerName.includes(fullName);
          });
          if (matchingMember) {
            autoFilledDriverId = matchingMember.id;
          }
        }

        // Priority 2: Last driver from previous reports
        if (!autoFilledDriverId) {
          autoFilledDriverId = getLastDriver(currentCarId);
        }

        if (autoFilledDriverId) {
          const lastDriver = members.find(m => String(m.id) === String(autoFilledDriverId));
          if (lastDriver) {
            setFormData(prev => ({
              ...prev,
              member_id: String(autoFilledDriverId),
              phone: lastDriver.phone || prev.phone
            }));
          }
        }
      }
    }
  }, [formData.car_id, members, cars, getLastDriver, isAdmin]);

  // Auto-fill phone when member changes
  useEffect(() => {
    const currentMemberId = typeof formData.member_id === 'object' ? (formData.member_id as any).id : formData.member_id;
    if (currentMemberId && members.length > 0) {
      const member = members.find(m => String(m.id) === String(currentMemberId));
      if (member) {
        const memberPhone = member.phone || (member as any).Phone || (member as any).phone_number || '';
        // Only auto-fill if phone is currently empty or if we just changed the member
        // To keep it simple, we'll update it if a phone exists for the member
        if (memberPhone && (formData.phone === '' || formData.phone === '08X-XXX-XXXX')) {
          setFormData(prev => ({ ...prev, phone: memberPhone }));
        }
      }
    }
  }, [formData.member_id, members]);

  const handleWebcamCapture = async (file: File) => {
    if (!webcamType) {
      console.warn('Webcam capture called but webcamType is null');
      setShowWebcam(false);
      return;
    }
    
    try {
      console.log(`Processing webcam capture for type: ${webcamType}`);
      // Create a mock event to reuse handlePhotoChange
      const mockEvent = {
        target: {
          files: [file]
        }
      } as any;
      
      setShowWebcam(false);
      await handlePhotoChange(mockEvent, webcamType);
    } catch (err) {
      console.error('Error in handleWebcamCapture:', err);
      setError(t('error_processing_photo'));
    } finally {
      setWebcamType(null);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'pickup' | 'delivery' | 'document') => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setProcessingPhotos(true);
    try {
      let newPhotos: any[] = [];
      if (type === 'pickup') newPhotos = [...pickupPhotos];
      else if (type === 'delivery') newPhotos = [...deliveryPhotos];
      else newPhotos = [...documentPhotos];

      for (const file of files) {
        // Extract EXIF data
        const metadata: any = await new Promise((resolve) => {
          EXIF.getData(file as any, function(this: any) {
            const allMetadata = EXIF.getAllTags(this);
            const lat = EXIF.getTag(this, "GPSLatitude");
            const lon = EXIF.getTag(this, "GPSLongitude");
            const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N";
            const lonRef = EXIF.getTag(this, "GPSLongitudeRef") || "E";
            const timestamp = EXIF.getTag(this, "DateTimeOriginal") || EXIF.getTag(this, "DateTime");

            let latitude = null;
            let longitude = null;

            if (lat && lat.length === 3) {
              latitude = lat[0] + lat[1] / 60 + lat[2] / 3600;
              if (latRef === "S") latitude = -latitude;
            }

            if (lon && lon.length === 3) {
              longitude = lon[0] + lon[1] / 60 + lon[2] / 3600;
              if (lonRef === "W") longitude = -longitude;
            }

            resolve({
              latitude,
              longitude,
              timestamp,
              all: allMetadata
            });
          });
        });

        const reader = new FileReader();
        const previewUrl = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        newPhotos.push({ file, preview: previewUrl, metadata });
      }

      if (type === 'pickup') setPickupPhotos(newPhotos);
      else if (type === 'delivery') setDeliveryPhotos(newPhotos);
      else setDocumentPhotos(newPhotos);
    } catch (err) {
      console.error('Error processing photos:', err);
    } finally {
      setProcessingPhotos(false);
    }
  };

  const removePhoto = (index: number, type: 'pickup' | 'delivery' | 'document') => {
    if (type === 'pickup') {
      setPickupPhotos(prev => prev.filter((_, i) => i !== index));
    } else if (type === 'delivery') {
      setDeliveryPhotos(prev => prev.filter((_, i) => i !== index));
    } else {
      setDocumentPhotos(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handlePointPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>, pointKey: string) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setProcessingPhotos(true);
    try {
      const currentPointPhotos = pointPhotosMap[pointKey] || [];
      const newProcessPhotos: {file: File, metadata: any, preview: string}[] = [...currentPointPhotos];

      for (const file of files) {
        const metadata: any = await new Promise((resolve) => {
          EXIF.getData(file as any, function(this: any) {
            const allMetadata = EXIF.getAllTags(this);
            const lat = EXIF.getTag(this, "GPSLatitude");
            const lon = EXIF.getTag(this, "GPSLongitude");
            const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N";
            const lonRef = EXIF.getTag(this, "GPSLongitudeRef") || "E";
            const timestamp = EXIF.getTag(this, "DateTimeOriginal") || EXIF.getTag(this, "DateTime");

            let latitude = null;
            let longitude = null;

            if (lat && lat.length === 3) {
              latitude = lat[0] + lat[1] / 60 + lat[2] / 3600;
              if (latRef === "S") latitude = -latitude;
            }

            if (lon && lon.length === 3) {
              longitude = lon[0] + lon[1] / 60 + lon[2] / 3600;
              if (lonRef === "W") longitude = -longitude;
            }

            resolve({ latitude, longitude, timestamp, all: allMetadata });
          });
        });

        const reader = new FileReader();
        const previewUrl = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        newProcessPhotos.push({ file, preview: previewUrl, metadata });
      }

      setPointPhotosMap(prev => ({ ...prev, [pointKey]: newProcessPhotos }));
    } catch (err) {
      console.error('Error processing point photos:', err);
    } finally {
      setProcessingPhotos(false);
    }
  };

  const removePointPhoto = (pointKey: string, photoIdx: number) => {
    setPointPhotosMap(prev => ({
      ...prev,
      [pointKey]: (prev[pointKey] || []).filter((_, i) => i !== photoIdx)
    }));
  };

  const sendLineNotification = async (to: string, messages: any[], altText: string) => {
    try {
      await lineService.sendPushMessage(to, messages);
      console.log(`LINE notification sent to ${to}`);
    } catch (err: any) {
      console.error(`Error sending LINE notification to ${to}:`, err.response?.data || err.message);
      throw err;
    }
  };

  const generateCustomerFlexMessage = (
    title: string,
    statusText: string,
    statusColor: string,
    data: {
      case_number: string;
      customer_name: string;
      origin: string;
      destination: string;
      routes?: any[];
      car_number: string;
      driver_name: string;
      driver_phone: string;
      report_id?: string;
    },
    status?: string
  ) => {
    const routeContents: any[] = [];
    
    if (data.routes && data.routes.length > 0) {
      data.routes.forEach((route, index) => {
        routeContents.push(
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: t('route_summary', { 
                  prefix: route.status === 'completed' ? '✅ ' : '📍 ', 
                  number: index + 1, 
                  origin: route.origin || '-', 
                  destination: route.destination || '-', 
                  status: route.status === 'completed' ? t('success_label') : '' 
                }),
                size: "sm",
                color: route.status === 'completed' ? "#27ae60" : "#111111",
                flex: 9,
                wrap: true,
                weight: route.status === 'completed' ? "bold" : "regular"
              }
            ]
          }
        );

        if (route.pickups && route.pickups.some((p: any) => p.time)) {
          route.pickups.forEach((p: any, i: number) => {
            if (p.time) {
              routeContents.push({
                type: "text",
                text: `🕒 ${t('pickup_time')}: ${formatFlexDateTime(p.time)}`,
                size: "xs",
                color: "#666666",
                margin: "xs",
                wrap: true
              });
            }
          });
        }
        if (route.deliveries && route.deliveries.some((d: any) => d.time)) {
          route.deliveries.forEach((d: any, i: number) => {
            if (d.time) {
              routeContents.push({
                type: "text",
                text: `🕒 ${t('delivery_time')}: ${formatFlexDateTime(d.time)}`,
                size: "xs",
                color: "#666666",
                margin: "xs",
                wrap: true
              });
            }
          });
        }
      });
    } else {
      routeContents.push(
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: t('from_to_summary', { origin: data.origin || '-', destination: data.destination || '-' }),
              size: "sm",
              color: "#111111",
              flex: 9,
              wrap: true
            }
          ]
        }
      );
    }

    return {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: t('app_name_line', 'Nationwide Express Tracker'),
            color: "#ffffff",
            weight: "bold",
            size: "md"
          }
        ],
        backgroundColor: "#2c5494"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: title,
            weight: "bold",
            size: "xl",
            margin: "md",
            color: "#e54d42",
            wrap: true,
            align: "center"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: t('origin_label'),
                    size: "xs",
                    color: "#2c5494",
                    weight: "bold",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: statusText,
                    size: "xs",
                    color: statusColor,
                    align: "center",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: t('destination_label'),
                    size: "xs",
                    color: "#aaaaaa",
                    align: "end",
                    flex: 1
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                margin: "sm",
                contents: [
                  {
                    type: "box",
                    layout: "vertical",
                    contents: [],
                    width: "12px",
                    height: "12px",
                    cornerRadius: "6px",
                    backgroundColor: "#2c5494"
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    contents: [],
                    height: "4px",
                    backgroundColor: status === 'completed' ? "#2c5494" : "#eeeeee",
                    flex: 1,
                    margin: "sm"
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    contents: [],
                    width: "12px",
                    height: "12px",
                    cornerRadius: "6px",
                    backgroundColor: status === 'completed' ? "#2c5494" : "#eeeeee"
                  }
                ],
                alignItems: "center"
              }
            ]
          },
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "🆔",
                    size: "sm",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: `${t('case_number_prefix', 'รหัสติดตามพัสดุ')} ${data.case_number || '-'}`,
                    size: "sm",
                    color: "#111111",
                    flex: 9
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "🏢",
                    size: "sm",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: t('customer_label', 'ลูกค้า'),
                    size: "sm",
                    color: "#2c5494",
                    weight: "bold",
                    flex: 3
                  },
                  {
                    type: "text",
                    text: data.customer_name || '-',
                    size: "sm",
                    color: "#111111",
                    flex: 6,
                    wrap: true
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "📦",
                    size: "sm",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: t('status_label', 'สถานะ'),
                    size: "sm",
                    color: "#2c5494",
                    weight: "bold",
                    flex: 3
                  },
                  {
                    type: "text",
                    text: statusText,
                    size: "sm",
                    color: statusColor,
                    flex: 6,
                    wrap: true
                  }
                ]
              },
              ...routeContents,
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "🚚",
                    size: "sm",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: t('car_label'),
                    size: "sm",
                    color: "#2c5494",
                    weight: "bold",
                    flex: 3
                  },
                  {
                    type: "text",
                    text: data.car_number || '-',
                    size: "sm",
                    color: "#111111",
                    flex: 6,
                    wrap: true
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "👤",
                    size: "sm",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: t('driver_label'),
                    size: "sm",
                    color: "#2c5494",
                    weight: "bold",
                    flex: 3
                  },
                  {
                    type: "text",
                    text: data.driver_name || '-',
                    size: "sm",
                    color: "#111111",
                    flex: 6,
                    wrap: true
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "📞",
                    size: "sm",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: t('driver_phone_label', 'เบอร์ติดต่อคนขับ'),
                    size: "sm",
                    color: "#2c5494",
                    weight: "bold",
                    flex: 3
                  },
                  {
                    type: "text",
                    text: data.driver_phone || '-',
                    size: "sm",
                    color: "#111111",
                    flex: 6,
                    wrap: true
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "📅",
                    size: "sm",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: t('date_label'),
                    size: "sm",
                    color: "#2c5494",
                    weight: "bold",
                    flex: 3
                  },
                  {
                    type: "text",
                    text: new Date().toISOString().slice(0, 16).replace('T', ' '),
                    size: "sm",
                    color: "#111111",
                    flex: 6,
                    wrap: true
                  }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          ...(status === 'completed' && data.report_id ? [{
            type: "button",
            style: "primary",
            height: "sm",
            action: {
              type: "uri",
              label: t('rate_service_label'),
              uri: `${window.location.origin}/rate/${data.report_id}`
            },
            color: "#f39c12",
            margin: "sm"
          }] : []),
          {
            type: "button",
            style: "primary",
            height: "sm",
            action: {
              type: "uri",
              label: t('enter_website_label'),
              uri: window.location.origin
            },
            color: "#e54d42"
          }
        ],
        flex: 0
      }
    };
  };

  const generateDriverFlexMessage = (
    title: string,
    data: {
      case_number: string;
      car_number: string;
      customer_name: string;
      contact_name: string;
      contact_phone: string;
      origin: string;
      origin_url?: string;
      destination: string;
      destination_url?: string;
      waypoints?: { name: string, url: string }[];
      routes?: any[];
      driver_name: string;
    }
  ) => {
    const footerContents: any[] = [];

    if (data.routes && data.routes.length > 0) {
      data.routes.forEach((route, index) => {
        const routeLabel = data.routes && data.routes.length > 1 ? ` (${t('route_number', { number: index + 1 })})` : '';
        
        if (route.pickups && route.pickups.length > 0) {
          route.pickups.forEach((p: any, i: number) => {
            if (p.url) {
              const label = route.pickups.length > 1 ? t('pickup_point_with_number', { number: i + 1 }) + routeLabel : t('origin_label') + routeLabel;
              footerContents.push({
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "uri",
                  label: (label || '').substring(0, 20), // LINE label limit is 20 chars
                  uri: p.url
                },
                margin: "sm"
              });
            }
          });
        } else if (route.origin_url) {
          footerContents.push({
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "uri",
              label: (t('origin_label') + routeLabel || '').substring(0, 20),
              uri: route.origin_url
            },
            margin: "sm"
          });
        }

        if (route.deliveries && route.deliveries.length > 0) {
          route.deliveries.forEach((d: any, i: number) => {
            if (d.url) {
              const label = route.deliveries.length > 1 ? t('delivery_point_with_number', { number: i + 1 }) + routeLabel : t('destination_label') + routeLabel;
              footerContents.push({
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "uri",
                  label: (label || '').substring(0, 20),
                  uri: d.url
                },
                margin: "sm"
              });
            }
          });
        } else if (route.destination_url) {
          footerContents.push({
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "uri",
              label: (t('destination_label') + routeLabel || '').substring(0, 20),
              uri: route.destination_url
            },
            margin: "sm"
          });
        }
      });
    } else {
      if (data.origin_url) {
        footerContents.push({
          type: "button",
          style: "secondary",
          height: "sm",
          action: {
            type: "uri",
            label: t('origin_map'),
            uri: data.origin_url
          },
          margin: "sm"
        });
      }

      if (data.destination_url) {
        footerContents.push({
          type: "button",
          style: "secondary",
          height: "sm",
          action: {
            type: "uri",
            label: t('destination_map'),
            uri: data.destination_url
          },
          margin: "sm"
        });
      }

      if (data.waypoints && data.waypoints.length > 0) {
        data.waypoints.forEach((wp, idx) => {
          if (wp.url) {
            footerContents.push({
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "uri",
                label: t('waypoint_with_number', { number: idx + 1 }),
                uri: wp.url
              },
              margin: "sm"
            });
          }
        });
      }
    }

    footerContents.push({
      type: "button",
      style: "primary",
      height: "sm",
      action: {
        type: "uri",
        label: t('enter_website_label'),
        uri: window.location.origin
      },
      color: "#e54d42",
      margin: "sm"
    });

    return {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: t('app_name_line', 'Nationwide Express Tracker'),
            color: "#ffffff",
            weight: "bold",
            size: "md"
          }
        ],
        backgroundColor: "#2c5494"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: title,
            weight: "bold",
            size: "xl",
            margin: "md",
            color: "#2c5494",
            wrap: true,
            align: "center"
          },
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "🆔",
                    size: "sm",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: `${t('case_number_prefix', 'รหัสติดตามพัสดุ')} ${data.case_number || '-'}`,
                    size: "sm",
                    color: "#111111",
                    flex: 9
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: t('registration_plate'),
                    size: "sm",
                    color: "#aaaaaa",
                    flex: 3
                  },
                  {
                    type: "text",
                    text: data.car_number || '-',
                    size: "sm",
                    color: "#111111",
                    flex: 7,
                    wrap: true
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: t('customer_label'),
                    size: "sm",
                    color: "#aaaaaa",
                    flex: 3
                  },
                  {
                    type: "text",
                    text: data.customer_name || '-',
                    size: "sm",
                    color: "#111111",
                    flex: 7,
                    wrap: true
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: t('contact_person_label'),
                    size: "sm",
                    color: "#aaaaaa",
                    flex: 3
                  },
                  {
                    type: "text",
                    text: data.contact_name || '-',
                    size: "sm",
                    color: "#111111",
                    flex: 7,
                    wrap: true
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: t('contact_phone_label'),
                    size: "sm",
                    color: "#aaaaaa",
                    flex: 3
                  },
                  {
                    type: "text",
                    text: data.contact_phone || '-',
                    size: "sm",
                    color: "#111111",
                    flex: 7,
                    wrap: true
                  }
                ]
              },
              ...(data.routes && data.routes.length > 0 ? data.routes.map((route, index) => {
                const routeContents: any[] = [
                  {
                    type: "text",
                    text: `${t('route_number', { number: index + 1 })}${route.status === 'completed' ? ` ✅ ${t('success_label')}` : ''}`,
                    size: "xs",
                    color: route.status === 'completed' ? "#27ae60" : "#aaaaaa",
                    weight: "bold"
                  }
                ];

                if (route.pickups && route.pickups.length > 0) {
                  route.pickups.forEach((p: any, i: number) => {
                    const timeStr = p.time ? ` 🕒 ${formatFlexDateTime(p.time)}` : '';
                    routeContents.push({
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: route.pickups.length > 1 ? t('pickup_point_with_number', { number: i + 1 }) : t('pickup_point_label'),
                          size: "sm",
                          color: "#aaaaaa",
                          flex: 3
                        },
                        {
                          type: "text",
                          text: (p.name || '-') + timeStr,
                          size: "sm",
                          color: "#111111",
                          flex: 7,
                          wrap: true
                        }
                      ]
                    });
                    if (p.contact_name || p.contact_phone) {
                      routeContents.push({
                        type: "box",
                        layout: "horizontal",
                        contents: [
                          {
                            type: "text",
                            text: " ",
                            size: "sm",
                            flex: 3
                          },
                          {
                            type: "text",
                            text: `👤 ${p.contact_name || '-'} 📞 ${p.contact_phone || '-'}`,
                            size: "xs",
                            color: "#666666",
                            flex: 7,
                            wrap: true
                          }
                        ]
                      });
                    }
                  });
                } else {
                  routeContents.push({
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      {
                        type: "text",
                        text: t('origin_label'),
                        size: "sm",
                        color: "#aaaaaa",
                        flex: 3
                      },
                      {
                        type: "text",
                        text: route.origin || '-',
                        size: "sm",
                        color: "#111111",
                        flex: 7,
                        wrap: true
                      }
                    ]
                  });
                }

                if (route.deliveries && route.deliveries.length > 0) {
                  route.deliveries.forEach((d: any, i: number) => {
                    routeContents.push({
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: route.deliveries.length > 1 ? t('delivery_point_with_number', { number: i + 1 }) : t('delivery_point_label'),
                          size: "sm",
                          color: "#aaaaaa",
                          flex: 3
                        },
                        {
                          type: "text",
                          text: d.name || '-',
                          size: "sm",
                          color: "#111111",
                          flex: 7,
                          wrap: true
                        }
                      ]
                    });
                    if (d.contact_name || d.contact_phone) {
                      routeContents.push({
                        type: "box",
                        layout: "horizontal",
                        contents: [
                          {
                            type: "text",
                            text: " ",
                            size: "sm",
                            flex: 3
                          },
                          {
                            type: "text",
                            text: `👤 ${d.contact_name || '-'} 📞 ${d.contact_phone || '-'}`,
                            size: "xs",
                            color: "#666666",
                            flex: 7,
                            wrap: true
                          }
                        ]
                      });
                    }
                    if (d.time) {
                      routeContents.push({
                        type: "box",
                        layout: "horizontal",
                        contents: [
                          {
                            type: "text",
                            text: " ",
                            size: "sm",
                            flex: 3
                          },
                          {
                            type: "text",
                            text: `🕒 ${t('delivery_time')}: ${formatFlexDateTime(d.time)}`,
                            size: "xs",
                            color: "#666666",
                            flex: 7,
                            wrap: true
                          }
                        ]
                      });
                    }
                  });
                } else {
                  routeContents.push({
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      {
                        type: "text",
                        text: t('destination_label'),
                        size: "sm",
                        color: "#aaaaaa",
                        flex: 3
                      },
                      {
                        type: "text",
                        text: route.destination || '-',
                        size: "sm",
                        color: "#111111",
                        flex: 7,
                        wrap: true
                      }
                    ]
                  });
                }

                return {
                  type: "box",
                  layout: "vertical",
                  margin: "md",
                  contents: routeContents
                };
              }) : [
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: t('origin_label'),
                      size: "sm",
                      color: "#aaaaaa",
                      flex: 3
                    },
                    {
                      type: "text",
                      text: data.origin || '-',
                      size: "sm",
                      color: "#111111",
                      flex: 7,
                      wrap: true
                    }
                  ]
                },
                ...(data.waypoints || []).map((wp, idx) => ({
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: t('waypoint', { number: idx + 1 }),
                      size: "sm",
                      color: "#aaaaaa",
                      flex: 3
                    },
                    {
                      type: "text",
                      text: wp.name || '-',
                      size: "sm",
                      color: "#111111",
                      flex: 7,
                      wrap: true
                    }
                  ]
                })),
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: t('destination_label'),
                      size: "sm",
                      color: "#aaaaaa",
                      flex: 3
                    },
                    {
                      type: "text",
                      text: data.destination || '-',
                      size: "sm",
                      color: "#111111",
                      flex: 7,
                      wrap: true
                    }
                  ]
                }
              ]),
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: t('date_label'),
                    size: "sm",
                    color: "#aaaaaa",
                    flex: 3
                  },
                  {
                    type: "text",
                    text: new Date().toISOString().slice(0, 16).replace('T', ' '),
                    size: "sm",
                    color: "#111111",
                    flex: 7,
                    wrap: true
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: t('driver_label'),
                    size: "sm",
                    color: "#aaaaaa",
                    flex: 3
                  },
                  {
                    type: "text",
                    text: data.driver_name || '-',
                    size: "sm",
                    color: "#111111",
                    flex: 7,
                    wrap: true
                  }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: footerContents,
        flex: 0
      }
    };
  };

  const sendCustomerStatusNotification = async (status: 'pending' | 'accepted' | 'completed', jobId?: string, targetCustomerId?: string) => {
    // Only send for Accepted (In Transit) and Completed statuses for customers
    if (status !== 'accepted' && status !== 'completed') {
      console.log(`Skipping customer notification for status: ${status}`);
      return;
    }

    try {
      const currentCustomerId = targetCustomerId || (typeof formData.customer_id === 'object' && formData.customer_id ? (formData.customer_id as any).id : formData.customer_id);
      const currentCarId = typeof formData.car_id === 'object' && formData.car_id ? (formData.car_id as any).id : formData.car_id;
      const currentMemberId = typeof formData.member_id === 'object' && formData.member_id ? (formData.member_id as any).id : formData.member_id;
      const currentReportId = jobId || id;

      console.log(`Starting customer notification for status: ${status}, customer_id: ${currentCustomerId}, report_id: ${currentReportId}`);
      
      const notificationsEnabled = localStorage.getItem('line_notifications_enabled') !== 'false';
      
      if (!notificationsEnabled) {
        console.log('Customer notifications are disabled in localStorage');
        return;
      }

      if (!currentCustomerId) {
        console.log('No customer ID provided for notification');
        return;
      }

      const customerLoc = customers.find(c => String(c.id) === String(currentCustomerId));
      
      if (!customerLoc) {
        console.log(`Customer location ${currentCustomerId} not found in customers list`);
        return;
      }
      
      const memberIds = getCustomerMemberIds(customerLoc);

      if (memberIds.length === 0) {
        console.log('Customer location has no members linked');
        return;
      }

      const selectedCar = cars.find(c => String(c.id) === String(currentCarId));
      const driver = members.find(m => String(m.id) === String(currentMemberId));
      
      const statusText = status === 'accepted' ? t('status_accepted_msg') : t('status_completed_msg');
      
      const statusColor = status === 'completed' ? '#27ae60' : '#2c5494'; 
      const displayId = formData.case_number || currentReportId;

      // Send notification to each member
      console.log(`Found ${memberIds.length} members to notify:`, memberIds);
      
      for (const memberId of memberIds) {
        try {
          const member = members.find(m => String(m.id) === String(memberId));
          
          if (!member) {
            console.log(`Member not found in state for ID: ${memberId}`);
            continue;
          }

          const customerLineId = resolveLineUserId(member.line_user_id);
          
          console.log(`Member ${memberId} resolved customerLineId:`, customerLineId);

          if (!customerLineId || typeof customerLineId !== 'string' || customerLineId.length < 5) {
            console.log(`Customer LINE ID not found or invalid for member: ${memberId}. LINE ID: ${customerLineId}. Member data:`, member);
            continue;
          }

          console.log(`Preparing message for member ${memberId} with LINE ID ${customerLineId}`);
          
          if (!customerLineId) {
            console.log(`Member ${memberId} has no LINE ID, skipping notification`);
            continue;
          }

          const flexContents = generateCustomerFlexMessage(
            t('job_status_notification'),
            statusText,
            statusColor,
            {
              case_number: String(formData.case_number || currentReportId || 'N/A'),
              customer_name: String(formData.customer_name || '-'),
              origin: String(formData.origin || '-'),
              destination: String(formData.destination || '-'),
              routes: formData.routes,
              car_number: String(selectedCar?.car_number || 'N/A'),
              driver_name: String(driver ? `${driver.first_name} ${driver.last_name}` : '-'),
              driver_phone: String(driver?.phone || '-'),
              report_id: currentReportId
            },
            status
          );

          const notificationTitle = `${t('job_status_notification')}: ${statusText}`;
          await sendLineNotification(customerLineId, [{ type: "flex", altText: notificationTitle, contents: flexContents }], notificationTitle);
        } catch (memberErr: any) {
          if (memberErr.response?.status === 401) return;
          console.error(`Failed to send LINE notification to member ${memberId}:`, memberErr);
        }
      }
    } catch (error: any) {
      if (error.response?.status === 401) return;
      console.error('Error in sendCustomerStatusNotification:', error);
    }
  };

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleCopyCaseNumber = () => {
    if (formData.case_number) {
      navigator.clipboard.writeText(formData.case_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleSubmit triggered', formData);
    
    // Basic validation for new reports
    if (!id) {
      if (!formData.car_id || !formData.member_id || !formData.customer_name || !formData.origin || !formData.destination) {
        setStatusConfig({
          type: 'error',
          title: t('incomplete_info'),
          message: t('please_fill_required')
        });
        setShowStatusModal(true);
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const executeSave = async () => {
    console.log('executeSave: START');
    setShowConfirmModal(false);
    setSubmitting(true);
    setError('');

    try {
      // Extract IDs properly
      const currentCustomerId = typeof formData.customer_id === 'object' && formData.customer_id ? (formData.customer_id as any).id : formData.customer_id;
      const currentCarId = typeof formData.car_id === 'object' && formData.car_id ? (formData.car_id as any).id : formData.car_id;
      const currentMemberId = typeof formData.member_id === 'object' && formData.member_id ? (formData.member_id as any).id : formData.member_id;

      console.log('executeSave: Extracted IDs:', { currentCustomerId, currentCarId, currentMemberId });
      
      // 1. Upload new photos to Directus if any
      console.log('executeSave: Starting photo uploads...');
      const pickupPhotoIds: string[] = [];
      const deliveryPhotoIds: string[] = [];
      const documentPhotoIds: string[] = [];
      const newPhotoMetadata: any[] = [];
      
      const uploadPhotos = async (photos: any[], targetArray: string[]) => {
        for (const photoObj of photos) {
          try {
            console.log(`executeSave: Uploading photo: ${photoObj.file.name}`);
            const fileId = await directusApi.uploadFile(photoObj.file);
            targetArray.push(fileId);
            
            if (photoObj.metadata) {
              newPhotoMetadata.push({
                file_id: fileId,
                latitude: photoObj.metadata.latitude,
                longitude: photoObj.metadata.longitude,
                timestamp: photoObj.metadata.timestamp
              });
            }
          } catch (uploadErr: any) {
            if (uploadErr.response?.status === 401) return;
            console.error('executeSave: Error uploading file:', uploadErr.response?.data || uploadErr.message);
            const detail = uploadErr.response?.data?.errors?.[0]?.message || uploadErr.message;
            throw new Error(`Failed to upload photo: ${detail}`);
          }
        }
      };

      await uploadPhotos(pickupPhotos, pickupPhotoIds);
      await uploadPhotos(deliveryPhotos, deliveryPhotoIds);
      await uploadPhotos(documentPhotos, documentPhotoIds);

      // 1.1 Upload point-specific photos
      console.log('executeSave: Starting point-specific photo uploads...');
      const processedRoutes = [...formData.routes]; // Use a copy to update point photos
      for (let rIdx = 0; rIdx < processedRoutes.length; rIdx++) {
        const route = processedRoutes[rIdx];
        
        // Pickups
        for (let pIdx = 0; pIdx < (route.pickups || []).length; pIdx++) {
          const key = `r-${rIdx}-p-${pIdx}`;
          const photosToUpload = pointPhotosMap[key] || [];
          if (photosToUpload.length > 0) {
            const uploadedIds = [];
            for (const p of photosToUpload) {
              const fileId = await directusApi.uploadFile(p.file);
              uploadedIds.push(fileId);
            }
            const currentPhotos = route.pickups[pIdx].photos || [];
            route.pickups[pIdx].photos = [...currentPhotos, ...uploadedIds];
          }
        }

        // Deliveries
        for (let dIdx = 0; dIdx < (route.deliveries || []).length; dIdx++) {
          const key = `r-${rIdx}-d-${dIdx}`;
          const photosToUpload = pointPhotosMap[key] || [];
          if (photosToUpload.length > 0) {
            const uploadedIds = [];
            for (const p of photosToUpload) {
              const fileId = await directusApi.uploadFile(p.file);
              uploadedIds.push(fileId);
            }
            const currentPhotos = route.deliveries[dIdx].photos || [];
            route.deliveries[dIdx].photos = [...currentPhotos, ...uploadedIds];
          }
        }
      }

      console.log('executeSave: Photo uploads completed');

      // Capture signature if pad is not empty
      let signatureFileId = '';
      if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
        try {
          console.log('executeSave: Capturing signature...');
          const canvas = signaturePadRef.current.getTrimmedCanvas();
          const signatureDataUrl = canvas.toDataURL('image/png');
          
          // Convert data URL to blob manually to avoid potential fetch issues with large data URLs
          const arr = signatureDataUrl.split(',');
          const mimeMatch = arr[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : 'image/png';
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const blob = new Blob([u8arr], { type: mime });
          
          const file = new File([blob], `signature-${Date.now()}.png`, { type: 'image/png' });
          console.log('executeSave: Uploading signature file...');
          signatureFileId = await directusApi.uploadFile(file);
          console.log('executeSave: Signature upload successful, ID:', signatureFileId);
        } catch (sigErr: any) {
          console.error('executeSave: Error capturing/uploading signature:', sigErr);
          throw new Error(`Failed to process signature: ${sigErr.message}`);
        }
      }

      // 1.6 Mandatory photos check for drivers
      console.log('executeSave: Performing validation checks...');
      if (!isAdmin && id && (formData.status === 'completed' || formData.status === 'accepted')) {
        // Require at least one photo across any category (now all labeled as document)
        const totalPhotos = 
          pickupPhotos.length + existingPickupPhotos.length + 
          deliveryPhotos.length + existingDeliveryPhotos.length + 
          documentPhotos.length + existingDocumentPhotos.length;
        
        // Also check per-point photos
        let pointPhotosCount = 0;
        formData.routes.forEach(r => {
          (r.pickups || []).forEach(p => { pointPhotosCount += (p.photos?.length || 0); });
          (r.deliveries || []).forEach(d => { pointPhotosCount += (d.photos?.length || 0); });
        });
        
        // Check local point photos map too
        Object.values(pointPhotosMap).forEach(photos => {
          pointPhotosCount += photos.length;
        });

        if (totalPhotos === 0 && pointPhotosCount === 0 && formData.status === 'completed') {
          setError(t('upload_photos_error'));
          setSubmitting(false);
          return;
        }
      }

      // 1.7 Mileage validation check
      const firstRoute = formData.routes[0];
      if (formData.car_id && firstRoute?.mileage_start && parseFloat(firstRoute.mileage_start.toString()) < getLastMileage(formData.car_id)) {
        setError(t('mileage_less_than_previous', { mileage: getLastMileage(formData.car_id) }));
        setSubmitting(false);
        return;
      }

      // 1.8 Time validation: Arrival cannot be before Departure (per route)
      for (let i = 0; i < formData.routes.length; i++) {
        const route = formData.routes[i];
        if (route.departure_time && route.arrival_time) {
          const departure = new Date(route.departure_time).getTime();
          const arrival = new Date(route.arrival_time).getTime();
          if (arrival < departure) {
            setError(`${t('route_index', { index: i + 1 })}: ${t('arrival_before_departure_error')}`);
            setSubmitting(false);
            return;
          }
        }
      }

      // 2. Prepare report data
      const reportData: any = {};
      
      const formatTime = (t: string) => {
        if (!t) return null;
        try {
          // Directus handles ISO 8601 strings well
          return new Date(t).toISOString();
        } catch (e) {
          return null;
        }
      };

      // Add fields only if they have values to support partial updates
      const standby = formatTime(formData.routes[0]?.standby_time);
      if (standby) reportData.standby_time = standby;

      const departure = formatTime(formData.routes[0]?.departure_time);
      if (departure) reportData.departure_time = departure;

      const arrival = formatTime(formData.routes[formData.routes.length - 1]?.arrival_time);
      if (arrival) reportData.arrival_time = arrival;

      const mStart = formData.routes[0]?.mileage_start;
      if (mStart !== undefined && mStart !== '') {
        const val = parseInt(mStart.toString());
        if (!isNaN(val)) reportData.mileage_start = val;
      }

      const mEnd = formData.routes[formData.routes.length - 1]?.mileage_end;
      if (mEnd !== undefined && mEnd !== '') {
        const val = parseInt(mEnd.toString());
        if (!isNaN(val)) reportData.mileage_end = val;
      }
      
      // Add routes data - always allow updates to routes (times/mileage)
      if (formData.routes !== undefined) {
        reportData.routes = processedRoutes.map((route: any) => ({
          ...route,
          standby_time: route.standby_time ? formatTime(route.standby_time) : (route.standby_time === '' ? null : (route.standby_time || null)),
          departure_time: route.departure_time ? formatTime(route.departure_time) : (route.departure_time === '' ? null : (route.departure_time || null)),
          arrival_time: route.arrival_time ? formatTime(route.arrival_time) : (route.arrival_time === '' ? null : (route.arrival_time || null)),
          mileage_start: (route.mileage_start !== undefined && route.mileage_start !== '') ? parseInt(route.mileage_start.toString()) : (route.mileage_start === '' ? null : route.mileage_start),
          mileage_end: (route.mileage_end !== undefined && route.mileage_end !== '') ? parseInt(route.mileage_end.toString()) : (route.mileage_end === '' ? null : route.mileage_end),
          pickups: route.pickups?.map((p: any) => ({
            ...p,
            time: p.time ? formatTime(p.time) : (p.time === '' ? null : (p.time || null))
          })),
          deliveries: route.deliveries?.map((d: any) => ({
            ...d,
            time: d.time ? formatTime(d.time) : (d.time === '' ? null : (d.time || null))
          }))
        }));
      }

      if (formData.notes) {
        reportData.notes = formData.notes;
      }

      if (formData.toll_fee !== undefined && formData.toll_fee !== '') {
        const val = parseFloat(formData.toll_fee.toString());
        if (!isNaN(val)) reportData.toll_fee = val;
      }
      if (formData.fuel_cost !== undefined && formData.fuel_cost !== '') {
        const val = parseFloat(formData.fuel_cost.toString());
        if (!isNaN(val)) reportData.fuel_cost = val;
      }
      if (formData.other_expenses !== undefined && formData.other_expenses !== '') {
        const val = parseFloat(formData.other_expenses.toString());
        if (!isNaN(val)) reportData.other_expenses = val;
      }
      if (formData.other_expenses_note !== undefined) {
        reportData.other_expenses_note = formData.other_expenses_note;
      }
      
      if (formData.expense_items !== undefined) {
        reportData.expense_items = formData.expense_items;
      }

      if (signatureFileId) {
        reportData.signature = signatureFileId;
      }
      if (formData.signature_name) {
        reportData.signature_name = formData.signature_name;
      }

      if (!id || isAdmin) {
        // New report OR Admin can edit everything
        // For new reports, we include the basic info
        if (formData.work_date) {
          const wd = formatTime(formData.work_date);
          if (wd) reportData.work_date = wd;
        }
        if (formData.advance_opening_time) {
          const aot = formatTime(formData.advance_opening_time);
          if (aot) reportData.advance_opening_time = aot;
          else if (formData.advance_opening_time === '') reportData.advance_opening_time = null;
        } else if (formData.advance_opening_time === '') {
          reportData.advance_opening_time = null;
        }
        
        if (formData.notify_driver_24h_before !== undefined) {
          reportData.notify_driver_24h_before = formData.notify_driver_24h_before;
        }

        if (formData.customer_name !== undefined) reportData.customer_name = formData.customer_name;
        if (currentCustomerId && currentCustomerId !== '') reportData.customer_id = currentCustomerId;
        if (formData.customer_contact_name !== undefined) reportData.customer_contact_name = formData.customer_contact_name;
        if (formData.customer_contact_phone !== undefined) reportData.customer_contact_phone = formData.customer_contact_phone;
        if (formData.origin !== undefined) reportData.origin = formData.origin;
        if (formData.origin_url !== undefined) reportData.origin_url = formData.origin_url;
        if (formData.origin_lat !== undefined) reportData.origin_lat = formData.origin_lat;
        if (formData.origin_lng !== undefined) reportData.origin_lng = formData.origin_lng;
        if (formData.destination !== undefined) reportData.destination = formData.destination;
        if (formData.destination_url !== undefined) reportData.destination_url = formData.destination_url;
        if (formData.destination_lat !== undefined) reportData.destination_lat = formData.destination_lat;
        if (formData.destination_lng !== undefined) reportData.destination_lng = formData.destination_lng;
        if (formData.estimated_distance !== undefined) reportData.estimated_distance = formData.estimated_distance;
        if (formData.phone !== undefined) reportData.phone = formData.phone;
        if (currentCarId && currentCarId !== '') reportData.car_id = currentCarId;
        if (currentMemberId && currentMemberId !== '') {
          reportData.member_id = currentMemberId;
          reportData.driver_id = currentMemberId; // Also save to driver_id for compatibility
        }
        if (formData.vehicle_type) reportData.vehicle_type = formData.vehicle_type;
        reportData.status = formData.status;
        if (formData.case_number) reportData.case_number = formData.case_number;

        if (formData.deadline_value) {
          const val = parseInt(formData.deadline_value.toString());
          if (!isNaN(val) && val > 0) {
            const deadlineDate = new Date();
            if (formData.deadline_unit === 'minutes') {
              deadlineDate.setMinutes(deadlineDate.getMinutes() + val);
            } else {
              deadlineDate.setHours(deadlineDate.getHours() + val);
            }
            reportData.acceptance_deadline = deadlineDate.toISOString();
          }
        }
      }

      reportData.pickup_photos = [...existingPickupPhotos, ...pickupPhotoIds];
      reportData.delivery_photos = [...existingDeliveryPhotos, ...deliveryPhotoIds];
      reportData.document_photos = [...existingDocumentPhotos, ...documentPhotoIds];
      reportData.photo_metadata = [...(formData.photo_metadata || []), ...newPhotoMetadata];
      
      console.log('Submitting report data:', reportData);

      if (id) {
        console.log('Updating existing report...');
        
        // Check if customer or car changed
        if (originalCustomerAndCar) {
          if (String(currentCustomerId) !== String(originalCustomerAndCar.customerId) || String(currentCarId) !== String(originalCustomerAndCar.carId)) {
            console.log('Customer or Car changed, unassigning old car from old customer...');
            await unassignCarFromCustomer(originalCustomerAndCar.customerId, originalCustomerAndCar.carId);
          }
        }

        await directusApi.updateWorkReport(id, reportData);
        console.log('Update successful');

        // Auto-link new car to new customer if changed or if it's a new assignment
        if (currentCustomerId && currentCarId) {
          await assignCarToCustomer(currentCustomerId, currentCarId, currentMemberId);
        }

        // Send notifications if status changed
        const statusChanged = reportData.status !== initialValues.status;
        const driverChanged = String(currentMemberId) !== String(initialValues.member_id);

        if (statusChanged && (reportData.status === 'completed' || reportData.status === 'accepted' || reportData.status === 'arrived')) {
          console.log(`Status changed to ${reportData.status}, triggering notifications...`);
          try {
            await sendCustomerStatusNotification(reportData.status as any);
            await sendDriverStatusNotification(reportData.status as any);
            if (reportData.status === 'completed') {
              await unassignCarFromCustomer(currentCustomerId, currentCarId);
            }
            console.log('Status change actions triggered successfully');
          } catch (notifyErr: any) {
            if (notifyErr.response?.status === 401) return;
            console.error('Error sending status change notifications:', notifyErr);
          }
        }

        // If driver changed, notify the new driver
        let notifiedAdditionalWork = false;
        if (driverChanged && currentMemberId) {
          console.log('Driver changed, notifying new driver...');
          await sendNewJobNotificationToDriver(currentMemberId, currentCarId);
        } else if (!driverChanged && currentMemberId) {
          // Check if routes/pickups/deliveries were added
          const countPickups = (routes: any[]) => {
            let total = 0;
            if (!routes) return total;
            routes.forEach(r => {
              if (r.pickups) total += r.pickups.filter((p: any) => p.name).length;
              else if (r.origin) total += 1;
            });
            return total;
          };

          const countDeliveries = (routes: any[]) => {
            let total = 0;
            if (!routes) return total;
            routes.forEach(r => {
              if (r.deliveries) total += r.deliveries.filter((d: any) => d.name).length;
              else if (r.destination) total += 1;
            });
            return total;
          };

          const oldPickups = countPickups(initialValues.routes);
          const newPickups = countPickups(formData.routes);
          const oldDeliveries = countDeliveries(initialValues.routes);
          const newDeliveries = countDeliveries(formData.routes);

          console.log('DEBUG: Point counts:', { 
            oldPickups, newPickups, 
            oldDeliveries, newDeliveries,
            pickupsAdded: newPickups > oldPickups,
            deliveriesAdded: newDeliveries > oldDeliveries
          });

          const pickupsAdded = newPickups > oldPickups;
          const deliveriesAdded = newDeliveries > oldDeliveries;

          if (pickupsAdded || deliveriesAdded) {
            console.log('Points added, notifying driver of additional work...', { pickupsAdded, deliveriesAdded });
            let type: 'pickup' | 'delivery' | 'both' = 'both';
            if (pickupsAdded && !deliveriesAdded) type = 'pickup';
            else if (!pickupsAdded && deliveriesAdded) type = 'delivery';
            
            await sendAdditionalWorkNotificationToDriver(currentMemberId, currentCarId, type);
            notifiedAdditionalWork = true;
          }
        }
        
        setStatusConfig({
          type: 'success',
          title: t('save_success'),
          message: notifiedAdditionalWork ? t('additional_work_saved_msg') : t('report_saved_success'),
          action: () => {
            navigate(isAdmin ? '/jobs/history' : '/jobs/my');
          }
        });
        setShowStatusModal(true);
      } else {
        console.log('Creating new report...');
        const result = await directusApi.createWorkReport(reportData);
        console.log('Creation successful:', result);

        // 1. Assign car to customer's members AND the driver
        if (currentCustomerId && currentCarId) {
          console.log('Assigning car to customer and driver:', { currentCustomerId, currentCarId, currentMemberId });
          await assignCarToCustomer(currentCustomerId, currentCarId, currentMemberId);
        }
        
        // 2. Send LINE notification to driver for NEW job
        await sendNewJobNotificationToDriver(currentMemberId, currentCarId);

        // Send LINE notification to customer and auto-link car
        try {
          await sendCustomerStatusNotification('pending', result.id, currentCustomerId);
        } catch (custErr: any) {
          if (custErr.response?.status === 401) return;
          console.error('Failed to send initial customer notification:', custErr);
        }

        // If the new report is already completed, unassign car
        if (reportData.status === 'completed') {
          await unassignCarFromCustomer();
        }

        setStatusConfig({
          type: 'success',
          title: t('save_success'),
          message: t('report_saved'),
          action: () => {
            navigate(isAdmin ? '/jobs/history' : '/jobs/my');
          }
        });
        setShowStatusModal(true);
      }
    } catch (error: any) {
      if (error.response?.status === 401) return;
      console.error('Error in handleSubmit:', error);
      console.error('Error response data:', error.response?.data);
      
      let errorMsg = error.message || t('error_saving_report');
      if (error.response?.data?.errors) {
        const directusErrors = error.response.data.errors;
        errorMsg = directusErrors.map((e: any) => e.message).join(', ');
      }
      
      setStatusConfig({
        type: 'error',
        title: t('error_saving_report'),
        message: errorMsg
      });
      setShowStatusModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  const sendNewJobNotificationToDriver = async (driverId: string, carId: string) => {
    try {
      const notificationsEnabled = localStorage.getItem('line_notifications_enabled') !== 'false';
      const driver = members.find(m => String(m.id) === String(driverId));
      const lineId = resolveLineUserId(driver?.line_user_id);
      
      console.log(`Driver ${driverId} resolved lineId:`, lineId);

      if (notificationsEnabled && lineId) {
        const selectedCar = cars.find(c => String(c.id) === String(carId));
        const accountSource = driver?.line_user_id ? t('registered_line') : t('created_admin');
        const driverName = driver ? `${driver.first_name} ${driver.last_name} ${accountSource}` : 'N/A';
        
        const flexContents = generateDriverFlexMessage(
          t('new_job_notification'),
          {
            case_number: String(formData.case_number || 'N/A'),
            car_number: String(selectedCar?.car_number || 'N/A'),
            customer_name: String(formData.customer_name || '-'),
            contact_name: String(getFormattedContactName(formData.customer_contact_name, formData.customer_id)),
            contact_phone: String(formData.customer_contact_phone || '-'),
            origin: String(formData.origin || '-'),
            origin_url: formData.origin_url,
            destination: String(formData.destination || '-'),
            destination_url: formData.destination_url,
            waypoints: formData.waypoints,
            routes: formData.routes,
            driver_name: String(driver ? `${driver.first_name} ${driver.last_name}` : '-')
          }
        );
        
        const routesText = (formData.routes && formData.routes.length > 0) 
          ? (formData.routes || []).map((route, idx) => {
              let text = `${t('route_number', { number: idx + 1 })}`;
              if (route.pickups && route.pickups.length > 0) {
                route.pickups.forEach((p: any, i: number) => {
                  const label = route.pickups.length > 1 ? t('pickup_point', { number: i + 1 }) : t('origin_label');
                  text += `\n${label}: ${p.name || '-'}`;
                  if (p.url) text += `\n📍 ${p.url}`;
                  if (p.contact_name) text += `\n👤 ${p.contact_name}`;
                  if (p.contact_phone) text += `\n📞 ${p.contact_phone}`;
                });
              } else {
                text += `\n${t('origin_label')}: ${route.origin}${route.origin_url ? `\n📍 ${route.origin_url}` : ''}`;
              }
              if (route.deliveries && route.deliveries.length > 0) {
                route.deliveries.forEach((d: any, i: number) => {
                  const label = route.deliveries.length > 1 ? t('delivery_point', { number: i + 1 }) : t('destination_label');
                  text += `\n${label}: ${d.name || '-'}`;
                  if (d.url) text += `\n🏁 ${d.url}`;
                  if (d.contact_name) text += `\n👤 ${d.contact_name}`;
                  if (d.contact_phone) text += `\n📞 ${d.contact_phone}`;
                });
              } else {
                text += `\n${t('destination_label')}: ${route.destination}${route.destination_url ? `\n🏁 ${route.destination_url}` : ''}`;
              }
              return text;
            }).join('\n\n')
          : `${t('origin_label')}: ${formData.origin}${formData.origin_url ? `\n📍 ${formData.origin_url}` : ''}\n${t('destination_label')}: ${formData.destination}${formData.destination_url ? `\n🏁 ${formData.destination_url}` : ''}`;

        const messages = [
          {
            type: "text",
            text: `${t('new_job_notification')}\n\n${t('case_id')}: ${formData.case_number || 'N/A'}\n${t('customer_label')}: ${formData.customer_name}\n${t('contact_person_label')}: ${getFormattedContactName(formData.customer_contact_name, formData.customer_id)}\n${t('contact_phone_label')}: ${formData.customer_contact_phone || '-'}\n\n${routesText}\n\n${t('car_label')}: ${selectedCar?.car_number || ''}\n${t('date_label')}: ${formData.work_date}\n${t('total_distance')}: ${formData.estimated_distance || 0} km`
          },
          {
            type: "flex",
            altText: t('new_job_details'),
            contents: flexContents
          }
        ];
        
        await lineService.sendPushMessage(lineId, messages);
        console.log('New job notification sent to driver successfully');
      }
    } catch (err: any) {
      if (err.response?.status === 401) return;
      console.error('Failed to send new job notification to driver:', err);
    }
  };

  const sendAdditionalWorkNotificationToDriver = async (driverId: string, carId: string, type: 'pickup' | 'delivery' | 'both' = 'both') => {
    try {
      const notificationsEnabled = localStorage.getItem('line_notifications_enabled') !== 'false';
      const driver = members.find(m => String(m.id) === String(driverId));
      const lineId = resolveLineUserId(driver?.line_user_id);
      
      console.log(`Driver ${driverId} resolved lineId for additional work:`, lineId);

      if (notificationsEnabled && lineId) {
        const selectedCar = cars.find(c => String(c.id) === String(carId));
        
            let title = t('additional_job_notification');
            if (type === 'pickup') title = t('new_pickup_point_notification');
            else if (type === 'delivery') title = t('new_delivery_point_notification');
            else title = t('new_both_points_notification');
        
        console.log(`Sending additional work notification: ${title} to ${lineId}`);

        const flexContents = generateDriverFlexMessage(
          title,
          {
            case_number: String(formData.case_number || 'N/A'),
            car_number: String(selectedCar?.car_number || 'N/A'),
            customer_name: String(formData.customer_name || '-'),
            contact_name: String(getFormattedContactName(formData.customer_contact_name, formData.customer_id)),
            contact_phone: String(formData.customer_contact_phone || '-'),
            origin: String(formData.origin || '-'),
            origin_url: formData.origin_url,
            destination: String(formData.destination || '-'),
            destination_url: formData.destination_url,
            waypoints: formData.waypoints,
            routes: formData.routes,
            driver_name: String(driver ? `${driver.first_name} ${driver.last_name}` : '-')
          }
        );
        
        const routesText = (formData.routes && formData.routes.length > 0) 
          ? (formData.routes || []).map((route, idx) => {
              let text = `${t('route_number', { number: idx + 1 })}`;
              if (route.pickups && route.pickups.length > 0) {
                route.pickups.forEach((p: any, i: number) => {
                  const label = route.pickups.length > 1 ? t('pickup_point', { number: i + 1 }) : t('origin_label');
                  text += `\n${label}: ${p.name || '-'}`;
                  if (p.url) text += `\n📍 ${p.url}`;
                  if (p.contact_name) text += `\n👤 ${p.contact_name}`;
                  if (p.contact_phone) text += `\n📞 ${p.contact_phone}`;
                });
              } else {
                text += `\n${t('origin_label')}: ${route.origin}${route.origin_url ? `\n📍 ${route.origin_url}` : ''}`;
              }
              if (route.deliveries && route.deliveries.length > 0) {
                route.deliveries.forEach((d: any, i: number) => {
                  const label = route.deliveries.length > 1 ? t('delivery_point', { number: i + 1 }) : t('destination_label');
                  text += `\n${label}: ${d.name || '-'}`;
                  if (d.url) text += `\n🏁 ${d.url}`;
                  if (d.contact_name) text += `\n👤 ${d.contact_name}`;
                  if (d.contact_phone) text += `\n📞 ${d.contact_phone}`;
                });
              } else {
                text += `\n${t('destination_label')}: ${route.destination}${route.destination_url ? `\n🏁 ${route.destination_url}` : ''}`;
              }
              return text;
            }).join('\n\n')
          : `${t('origin_label')}: ${formData.origin}${formData.origin_url ? `\n📍 ${formData.origin_url}` : ''}\n${t('destination_label')}: ${formData.destination}${formData.destination_url ? `\n🏁 ${formData.destination_url}` : ''}`;

        const messages = [
          {
            type: "text",
            text: `${title}\n\n${t('case_id')}: ${formData.case_number || 'N/A'}\n${t('customer_label')}: ${formData.customer_name}\n${t('contact_person_label')}: ${getFormattedContactName(formData.customer_contact_name, formData.customer_id)}\n${t('contact_phone_label')}: ${formData.customer_contact_phone || '-'}\n\n${routesText}\n\n${t('car_label')}: ${selectedCar?.car_number || ''}\n${t('date_label')}: ${formData.work_date}\n${t('total_distance')}: ${formData.estimated_distance || 0} km`
          },
          {
            type: "flex",
            altText: title,
            contents: flexContents
          }
        ];
        
        await lineService.sendPushMessage(lineId, messages);
        console.log('Additional work notification sent to driver successfully');
      } else {
        console.warn('Skipping additional work notification:', { notificationsEnabled, hasLineId: !!lineId, driverId });
      }
    } catch (err: any) {
      if (err.response?.status === 401) return;
      console.error('Failed to send additional work notification to driver:', err);
    }
  };

  const sendDriverStatusNotification = async (status: 'accepted' | 'completed') => {
    try {
      const currentMemberId = typeof formData.member_id === 'object' ? (formData.member_id as any).id : formData.member_id;
      const member = members.find(m => String(m.id) === String(currentMemberId));
      const driverLineId = resolveLineUserId(member?.line_user_id);
      
      console.log(`Driver status notification: memberId: ${currentMemberId}, resolved driverLineId:`, driverLineId);

      if (!driverLineId) {
        console.log('Member LINE ID not found, skipping notification.');
        return;
      }

      const selectedCar = cars.find(c => String(c.id) === String(typeof formData.car_id === 'object' ? (formData.car_id as any)?.id : formData.car_id));
      const statusText = status === 'accepted' ? t('status_accepted_msg') : t('status_completed_msg');
      
      const headerColor = '#2c5494'; // NES Blue
      const statusColor = status === 'completed' ? '#27ae60' : '#e54d42';

      const flexContents = generateDriverFlexMessage(
        `${t('job_status_notification')}: ${statusText}`,
        {
          case_number: String(formData.case_number || 'N/A'),
          car_number: String(selectedCar?.car_number || 'N/A'),
          customer_name: String(formData.customer_name || '-'),
          contact_name: String(getFormattedContactName(formData.customer_contact_name, formData.customer_id)),
          contact_phone: String(formData.customer_contact_phone || '-'),
          origin: String(formData.origin || '-'),
          origin_url: formData.origin_url,
          destination: String(formData.destination || '-'),
          destination_url: formData.destination_url,
          waypoints: formData.waypoints,
          routes: formData.routes,
          driver_name: String(member ? `${member.first_name} ${member.last_name}` : '-')
        }
      );

      const routesText = (formData.routes && formData.routes.length > 0) 
        ? (formData.routes || []).map((route, idx) => {
            let text = `${t('route_number', { number: idx + 1 })}:`;
            if (route.pickups && route.pickups.length > 0) {
              route.pickups.forEach((p: any, i: number) => {
                const label = route.pickups.length > 1 ? t('pickup_point_with_number', { number: i + 1 }) : t('origin_label');
                text += `\n${label}: ${p.name || '-'}`;
                if (p.url) text += `\n📍 ${p.url}`;
                if (p.contact_name) text += `\n👤 ${p.contact_name}`;
                if (p.contact_phone) text += `\n📞 ${p.contact_phone}`;
              });
            } else {
              text += `\n${t('origin_label')}: ${route.origin}${route.origin_url ? `\n📍 ${route.origin_url}` : ''}`;
            }
            if (route.deliveries && route.deliveries.length > 0) {
              route.deliveries.forEach((d: any, i: number) => {
                const label = route.deliveries.length > 1 ? t('delivery_point_with_number', { number: i + 1 }) : t('destination_label');
                text += `\n${label}: ${d.name || '-'}`;
                if (d.url) text += `\n🏁 ${d.url}`;
                if (d.contact_name) text += `\n👤 ${d.contact_name}`;
                if (d.contact_phone) text += `\n📞 ${d.contact_phone}`;
              });
            } else {
              text += `\n${t('destination_label')}: ${route.destination}${route.destination_url ? `\n🏁 ${route.destination_url}` : ''}`;
            }
            return text;
          }).join('\n\n')
        : `${t('origin_label')}: ${formData.origin}${formData.origin_url ? `\n📍 ${formData.origin_url}` : ''}\n${t('destination_label')}: ${formData.destination}${formData.destination_url ? `\n🏁 ${formData.destination_url}` : ''}`;

      const driverMessages = [
        {
          type: "text",
          text: `🔔 ${t('job_status_notification')}: ${statusText}\n\n${t('case_id')}: ${formData.case_number || 'N/A'}\n${t('customer_label')}: ${formData.customer_name}\n\n${routesText}\n\n${t('car_label')}: ${selectedCar?.car_number || ''}\n${t('total_distance')}: ${formData.estimated_distance || 0} km`
        },
        {
          type: "flex",
          altText: `🔔 Nationwide Express Tracker: ${statusText}`,
          contents: flexContents
        }
      ];

      await sendLineNotification(driverLineId, driverMessages, `🔔 Nationwide Express Tracker: ${statusText}`);
      console.log(`Driver notification (${status}) sent to ${driverLineId}`);
    } catch (err: any) {
      if (err.response?.status === 401) return;
      console.error('Error sending driver status notification:', err.response?.data || err.message);
    }
  };

  const assignCarToCustomer = async (customerId: string, carId: string, driverId?: string) => {
    if (!customerId || !carId) {
      console.log('assignCarToCustomer: Missing customerId or carId', { customerId, carId });
      return;
    }
    try {
      console.log(`assignCarToCustomer: Assigning car ${carId} to customer ${customerId} and driver ${driverId}...`);
      
      // Ensure we have the latest customers data if possible, but use state for now
      const customerLoc = customers.find(c => String(c.id) === String(customerId));
      
      if (!customerLoc) {
        console.warn('assignCarToCustomer: Customer location not found in state for ID:', customerId);
        // Try to fetch it directly if not in state
        try {
          const freshLoc = await directusApi.getCustomerLocation(customerId);
          if (freshLoc) {
            console.log('assignCarToCustomer: Fetched fresh customer location:', freshLoc.company_name);
            await processAssignment(freshLoc, carId, driverId);
            return;
          }
        } catch (err: any) {
          if (err.response?.status === 401) return;
          console.error('assignCarToCustomer: Failed to fetch fresh customer location:', err);
        }
        return;
      }

      await processAssignment(customerLoc, carId, driverId);
    } catch (error: any) {
      if (error.response?.status === 401) return;
      console.error('Error in assignCarToCustomer:', error);
    }
  };

  const processAssignment = async (customerLoc: any, carId: string, driverId?: string) => {
    console.log('processAssignment: Processing for:', customerLoc.company_name, 'Car:', carId, 'Driver:', driverId);

    const memberIds = getCustomerMemberIds(customerLoc);
    
    // Resolve driver
    if (driverId) {
      const resolvedDriverId = resolveMemberId(driverId);
      if (resolvedDriverId && !memberIds.includes(resolvedDriverId)) {
        console.log('processAssignment: Adding driver ID:', resolvedDriverId);
        memberIds.push(resolvedDriverId);
      } else if (!resolvedDriverId) {
        console.warn('processAssignment: Could not resolve driver member ID:', driverId);
      }
    }

    if (memberIds.length === 0) {
      console.warn('processAssignment: No valid member IDs found to link car to');
      return;
    }

    console.log('processAssignment: Final unique member IDs to link:', memberIds);

    if (!directusApi.linkCarToMember) {
      console.error('processAssignment: directusApi.linkCarToMember is NOT defined!');
      return;
    }

    // Link each member to the car
    const linkPromises = memberIds.map(async (mid) => {
      try {
        console.log(`processAssignment: Linking car ${carId} to member ${mid}`);
        await directusApi.linkCarToMember(carId, mid);
      } catch (linkErr: any) {
        if (linkErr.response?.status === 401) return;
        console.error(`processAssignment: Failed to link car ${carId} to member ${mid}:`, linkErr);
      }
    });

    await Promise.all(linkPromises);
    console.log('processAssignment: Car linking process completed');
  };

  const unassignCarFromCustomer = async (targetCustomerId?: string, targetCarId?: string) => {
    try {
      const customerId = targetCustomerId || (typeof formData.customer_id === 'object' ? (formData.customer_id as any).id : formData.customer_id);
      const carId = targetCarId || (typeof formData.car_id === 'object' ? (formData.car_id as any).id : formData.car_id);
      
      if (!customerId || !carId) return;

      console.log(`Attempting to unassign car ${carId} from customer ${customerId}...`);
      
      const customerLocation = await directusApi.getCustomerLocation(customerId);
      
      const memberIds = getCustomerMemberIds(customerLocation);

      // Add driver to unassign list
      const memberIdRaw = typeof formData.member_id === 'object' ? (formData.member_id as any).id : formData.member_id;
      const memberId = resolveMemberId(String(memberIdRaw));
      if (memberId && !memberIds.includes(memberId)) {
        memberIds.push(memberId);
      }

      if (memberIds.length === 0) {
        console.log('No members linked to this customer location');
        return;
      }

      // Unassign for all members
      for (const memberId of memberIds) {
        console.log(`Checking permissions for member: ${memberId}`);
        const permissions = await directusApi.getCarPermissions(memberId);
        
        const permissionToDelete = permissions.find(p => {
          if (!p.car_id) return false;
          const pCarId = typeof p.car_id === 'object' ? (p.car_id as any).id : p.car_id;
          return String(pCarId) === String(carId);
        });

        if (permissionToDelete) {
          console.log('Deleting car permission:', permissionToDelete.id, 'for member:', memberId);
          await directusApi.deleteCarPermission(permissionToDelete.id);
        }
      }
      console.log('Car unassigned from all linked customers successfully');
    } catch (error: any) {
      if (error.response?.status === 401) return;
      console.error('Error in unassignCarFromCustomer:', error);
    }
  };

  const handleAcceptJob = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      const now = new Date();
      const acceptedAt = now.toISOString();
      
      // Format for standby_time (YYYY-MM-DDTHH:mm) for the input field
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const standbyTimeInput = `${year}-${month}-${day}T${hours}:${minutes}`;

      await directusApi.updateWorkReport(id, { 
        status: 'accepted',
        accepted_at: acceptedAt,
        standby_time: acceptedAt
      });
      
      setFormData(prev => ({ 
        ...prev, 
        status: 'accepted', 
        accepted_at: acceptedAt,
        standby_time: standbyTimeInput
      }));
      
      // Notify customer
      const customerId = typeof formData.customer_id === 'object' && formData.customer_id ? (formData.customer_id as any).id : formData.customer_id;
      await sendCustomerStatusNotification('accepted', id, customerId);

      // Notify driver
      await sendDriverStatusNotification('accepted');

      setStatusConfig({
        type: 'success',
        title: t('job_accepted'),
        message: isAdmin ? t('status_accepted') : t('job_accepted')
      });
      setShowStatusModal(true);
    } catch (error: any) {
      if (error.response?.status === 401) return;
      console.error('Error accepting job:', error);
      setStatusConfig({
        type: 'error',
        title: t('error'),
        message: error.message || t('error_accepting_job')
      });
      setShowStatusModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  const verifyGeofence = async (type: 'completed'): Promise<{ lat: number, lng: number, verified: boolean, distance: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          let targetLat = formData.destination_lat;
          let targetLng = formData.destination_lng;
          
          if (!targetLat || !targetLng) {
            resolve({ lat: latitude, lng: longitude, verified: true, distance: 0 });
            return;
          }
          
          const distance = calculateDistance(latitude, longitude, targetLat, targetLng);
          const verified = distance <= 500; // 500 meters
          resolve({ lat: latitude, lng: longitude, verified, distance });
        },
        (error) => {
          console.error("Geolocation error:", error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleCompleteJob = () => {
    setShowCompleteConfirm(true);
  };

  const confirmCompleteJob = async () => {
    if (!id) return;
    setShowCompleteConfirm(false);
    setSubmitting(true);
    try {
      // Prepare the full dataset for completion, just like executeSave
      const formatTime = (t: string) => {
        if (!t) return null;
        try { return new Date(t).toISOString(); } catch (e) { return null; }
      };

      const updatePayload: any = { 
        status: 'completed',
        notes: formData.notes,
        signature: formData.signature,
        signature_name: formData.signature_name
      };
      
      const standby = formatTime(formData.routes[0]?.standby_time);
      if (standby) updatePayload.standby_time = standby;

      const departure = formatTime(formData.routes[0]?.departure_time);
      if (departure) updatePayload.departure_time = departure;

      const arrival = formatTime(formData.routes[formData.routes.length - 1]?.arrival_time);
      if (arrival) updatePayload.arrival_time = arrival;

      const mStart = formData.routes[0]?.mileage_start;
      if (mStart !== undefined && mStart !== '') {
        const val = parseInt(mStart.toString());
        if (!isNaN(val)) updatePayload.mileage_start = val;
      }
      
      const mEnd = formData.routes[formData.routes.length - 1]?.mileage_end;
      if (mEnd !== undefined && mEnd !== '') {
        const val = parseInt(mEnd.toString());
        if (!isNaN(val)) updatePayload.mileage_end = val;
      }

      if (formData.routes !== undefined) {
        updatePayload.routes = formData.routes.map((route: any) => ({
          ...route,
          standby_time: formatTime(route.standby_time),
          departure_time: formatTime(route.departure_time),
          arrival_time: formatTime(route.arrival_time),
          mileage_start: (route.mileage_start !== undefined && route.mileage_start !== '') ? parseInt(route.mileage_start.toString()) : (route.mileage_start === '' ? null : route.mileage_start),
          mileage_end: (route.mileage_end !== undefined && route.mileage_end !== '') ? parseInt(route.mileage_end.toString()) : (route.mileage_end === '' ? null : route.mileage_end),
          pickups: route.pickups?.map((p: any) => ({
            ...p,
            time: formatTime(p.time)
          })),
          deliveries: route.deliveries?.map((d: any) => ({
            ...d,
            time: formatTime(d.time)
          }))
        }));
      }

      if (!isAdmin) {
        const geoResult = await verifyGeofence('completed');
        if (geoResult) {
          updatePayload.is_geofence_verified = geoResult.verified;
          updatePayload.actual_completed_lat = geoResult.lat;
          updatePayload.actual_completed_lng = geoResult.lng;
          
          if (!geoResult.verified) {
            setStatusConfig({
              type: 'error',
              title: t('geofence_error_title', 'ไม่อยู่ในพื้นที่ที่กำหนด'),
              message: t('geofence_error_msg', `คุณอยู่ห่างจากจุดหมายเกินไป (${Math.round(geoResult.distance)} เมตร) ไม่สามารถเปลี่ยนสถานะได้`)
            });
            setShowStatusModal(true);
            setSubmitting(false);
            
            // Save the failed attempt coordinates
            await directusApi.updateWorkReport(id, {
              is_geofence_verified: false,
              actual_completed_lat: geoResult.lat,
              actual_completed_lng: geoResult.lng
            }).catch(console.error);
            return;
          }
        }
      }

      await directusApi.updateWorkReport(id, updatePayload);
      setFormData(prev => ({ ...prev, ...updatePayload }));
      
      // Notify customer
      const customerId = typeof formData.customer_id === 'object' && formData.customer_id ? (formData.customer_id as any).id : formData.customer_id;
      await sendCustomerStatusNotification('completed', id, customerId);
      
      // Notify driver
      await sendDriverStatusNotification('completed');

      // Unassign car from customer
      await unassignCarFromCustomer();

      setStatusConfig({
        type: 'success',
        title: t('job_completed'),
        message: t('status_updated_completed')
      });
      setShowStatusModal(true);
    } catch (error: any) {
      if (error.response?.status === 401) return;
      console.error('Error completing job:', error);
      setStatusConfig({
        type: 'error',
        title: t('error'),
        message: error.message || t('error_saving')
      });
      setShowStatusModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopenJob = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await directusApi.updateWorkReport(id, { status: 'pending' });
      setFormData(prev => ({ ...prev, status: 'pending' }));
      setStatusConfig({
        type: 'success',
        title: t('job_reopened'),
        message: t('status_updated_pending')
      });
      setShowStatusModal(true);
    } catch (error: any) {
      if (error.response?.status === 401) return;
      console.error('Error reopening job:', error);
      setStatusConfig({
        type: 'error',
        title: t('error'),
        message: error.message || t('error_saving')
      });
      setShowStatusModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteJob = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteJob = async () => {
    if (!id) return;
    setShowDeleteConfirm(false);
    
    setSubmitting(true);
    try {
      // Unassign car from customer before deleting the report
      await unassignCarFromCustomer();
      
      // Instead of hard delete, update status to 'deleted' so it shows in history
      await directusApi.updateWorkReport(id, { 
        status: 'deleted',
        status_logs: [
          ...(formData.status_logs || []),
          { status: 'deleted', timestamp: new Date().toISOString() }
        ]
      });
      navigate(isAdmin ? '/jobs/history' : '/jobs/my');
    } catch (error: any) {
      if (error.response?.status === 401) return;
      console.error('Error deleting job:', error);
      setStatusConfig({
        type: 'error',
        title: t('error'),
        message: error.message || t('error_deleting_job')
      });
      setShowStatusModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelJob = async () => {
    if (!id) return;
    
    if (!isAdmin) {
      setStatusConfig({
        type: 'error',
        title: t('error_occurred'),
        message: t('permission_denied')
      });
      setShowStatusModal(true);
      return;
    }

    if (!cancelReasonInput.trim()) {
      setStatusConfig({
        type: 'error',
        title: t('error_occurred'),
        message: t('enter_cancel_reason')
      });
      setShowStatusModal(true);
      return;
    }

    setSubmitting(true);
    try {
      await unassignCarFromCustomer();
      await directusApi.updateWorkReport(id, { 
        status: 'cancelled',
        cancel_reason: cancelReasonInput,
        notes: (formData.notes ? formData.notes + '\n' : '') + `${t('cancel_reason_prefix')}: ${cancelReasonInput}`
      });
      setFormData(prev => ({ 
        ...prev, 
        status: 'cancelled', 
        cancel_reason: cancelReasonInput,
        notes: (prev.notes ? prev.notes + '\n' : '') + `${t('cancel_reason_prefix')}: ${cancelReasonInput}`
      }));
      setStatusConfig({
        type: 'success',
        title: t('job_cancelled'),
        message: t('job_cancelled_success'),
        action: () => navigate(isAdmin ? '/jobs/history' : '/jobs/my')
      });
      setShowStatusModal(true);
    } catch (error: any) {
      if (error.response?.status === 401) return;
      console.error('Error cancelling job:', error);
      setStatusConfig({
        type: 'error',
        title: t('error_occurred'),
        message: error.message || t('cannot_cancel_job')
      });
      setShowStatusModal(true);
    } finally {
      setSubmitting(false);
      setShowCancelConfirm(false);
    }
  };

  const handleApproveCancel = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await unassignCarFromCustomer();
      await directusApi.updateWorkReport(id, { status: 'cancelled' });
      setFormData(prev => ({ ...prev, status: 'cancelled' }));
      setStatusConfig({
        type: 'success',
        title: t('cancel_approved'),
        message: t('cancel_approved_success')
      });
      setShowStatusModal(true);
    } catch (error: any) {
      if (error.response?.status === 401) return;
      console.error('Error approving cancellation:', error);
      setStatusConfig({
        type: 'error',
        title: t('error'),
        message: error.message || t('error_approving_cancel')
      });
      setShowStatusModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectCancel = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await directusApi.updateWorkReport(id, { status: 'accepted' });
      setFormData(prev => ({ ...prev, status: 'accepted' }));
      setStatusConfig({
        type: 'success',
        title: t('cancel_rejected'),
        message: t('cancel_rejected_success')
      });
      setShowStatusModal(true);
    } catch (error: any) {
      if (error.response?.status === 401) return;
      console.error('Error rejecting cancellation:', error);
      setStatusConfig({
        type: 'error',
        title: t('error'),
        message: error.message || t('error_rejecting_cancel')
      });
      setShowStatusModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  const getFormattedContactName = (contactName: string, customerId: any) => {
    if (!customerId) return contactName || '-';
    
    const currentCustomerId = typeof customerId === 'object' ? (customerId as any).id : customerId;
    const cust = customers.find(c => String(c.id) === String(currentCustomerId));
    
    if (!cust) return contactName || '-';

    const memberIds = getCustomerMemberIds(cust);

    if (memberIds.length === 0) return contactName || '-';

    const selectedMembers = members.filter(m => memberIds.includes(String(m.id)));
    
    return selectedMembers.map((m, idx) => {
      const lineName = m.display_name || '';
      const realName = `${m.first_name || ''} ${m.last_name || ''}`.trim();
      
      if (lineName && realName && lineName !== realName) {
        return `${idx + 1}. ${realName} (${lineName})`;
      } else if (realName) {
        return `${idx + 1}. ${realName}`;
      } else if (lineName) {
        return `${idx + 1}. ${lineName}`;
      }
      return `${idx + 1}. -`;
    }).join('\n');
  };

  const generateReportText = () => {
    const currentCarId = typeof formData.car_id === 'object' ? (formData.car_id as any).id : formData.car_id;
    const currentMemberId = typeof formData.member_id === 'object' ? (formData.member_id as any).id : formData.member_id;
    const selectedCar = cars.find(c => String(c.id) === String(currentCarId));
    const selectedMember = members.find(m => String(m.id) === String(currentMemberId));
    const accountSource = selectedMember?.line_user_id ? t('registered_line') : t('created_admin');
    const memberRoleLabel = selectedMember?.role === 'customer' ? t('customer_role') : t('driver_role');
    
    const formatDisplayDT = (dt: string) => dt ? dt.replace('T', ' ') : '-';
    
    let routesText = '';
    if (formData.routes && formData.routes.length > 0) {
      routesText = formData.routes.map((route, index) => {
        let routeDetails = `\n${t('route_number', { number: index + 1 })}:`;
        
        if (route.pickups && route.pickups.length > 0) {
          route.pickups.forEach((p: any, i: number) => {
            const label = route.pickups.length > 1 ? t('pickup_point', { number: i + 1 }) : t('origin_label');
            routeDetails += `\n📍 ${label} : ${p.name || '-'}`;
            if (p.url) routeDetails += `\n🔗 ${t('link_to', { label })} : ${p.url}`;
            if (p.contact_name) routeDetails += `\n👤 ${t('contact_person_label')} : ${p.contact_name}`;
            if (p.contact_phone) routeDetails += `\n📞 ${t('contact_phone_label')} : ${p.contact_phone}`;
          });
        } else {
          routeDetails += `\n📍 ${t('origin_label')} : ${route.origin || '-'}`;
          routeDetails += `\n🔗 ${t('link_to', { label: t('origin_label') })} : ${route.origin_url || '-'}`;
        }

        if (route.deliveries && route.deliveries.length > 0) {
          route.deliveries.forEach((d: any, i: number) => {
            const label = route.deliveries.length > 1 ? t('delivery_point', { number: i + 1 }) : t('destination_label');
            routeDetails += `\n📍 ${label} : ${d.name || '-'}`;
            if (d.url) routeDetails += `\n🔗 ${t('link_to', { label })} : ${d.url}`;
            if (d.contact_name) routeDetails += `\n👤 ${t('contact_person_label')} : ${d.contact_name}`;
            if (d.contact_phone) routeDetails += `\n📞 ${t('contact_phone_label')} : ${d.contact_phone}`;
          });
        } else {
          routeDetails += `\n📍 ${t('destination_label')} : ${route.destination || '-'}`;
          routeDetails += `\n🔗 ${t('link_to', { label: t('destination_label') })} : ${route.destination_url || '-'}`;
        }
        
        routeDetails += `\n🗓️ ${t('date')} : ${route.date || '-'}`;
        routeDetails += `\n🕒 ${t('standby_time')} : ${formatDisplayDT(route.standby_time || '')}`;
        routeDetails += `\n🕒 ${t('departure_time')} : ${formatDisplayDT(route.departure_time || '')}`;
        routeDetails += `\n🕒 ${t('arrival_time')} : ${formatDisplayDT(route.arrival_time || '')}`;
        routeDetails += `\n📌 ${t('mileage_start')} : ${route.mileage_start || '-'}`;
        routeDetails += `\n📌 ${t('mileage_end')} : ${route.mileage_end || '-'}`;
        routeDetails += `\n📏 ${t('distance')} : ${route.distance !== undefined ? route.distance + ' km' : '-'}`;
        
        return routeDetails;
      }).join('\n');
    } else {
      routesText = `📍 ${t('origin_label')} : ${formData.origin || '-'}
📍 ${t('destination_label')} : ${formData.destination || '-'}`;
    }
    
    const bkkMaxDistance = parseInt(localStorage.getItem('bkk_max_distance') || '250', 10);
    const classification = formData.estimated_distance !== undefined 
      ? ` (${formData.estimated_distance > bkkMaxDistance ? t('upcountry') : t('bangkok_vicinity')})`
      : '';
    
    return `🆔 ${t('case_number')} : ${formData.case_number || '-'}
📅 ${t('report_date')} : ${formData.work_date}
📁 ${t('customer_name')} : ${formData.customer_name}
👤 ${t('contact_person_label')} : ${getFormattedContactName(formData.customer_contact_name, formData.customer_id)}
📞 ${t('contact_phone_label')} : ${formData.customer_contact_phone || '-'}
${routesText}
${formData.estimated_distance !== undefined ? `\n📏 ${t('estimated_distance')} ${t('total_distance')} : ${formData.estimated_distance} ${t('km')}${classification}` : ''}

🚚 ${t('car_plate')} : ${selectedCar?.car_number || currentCarId}

👷 ${memberRoleLabel} : ${selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name} ${accountSource}` : currentMemberId}
📞 ${t('phone')} : ${formData.phone}

📏 ${t('total_distance')} (km) : ${totalDistance.toLocaleString()} km

📌 ${t('notes')} : ${formData.notes || '-'}`;
  };

  const isCustomer = userRole.toLowerCase() === 'customer';
  const isEditable = (!id || isAdmin || formData.status === 'accepted' || formData.status === 'pending') && !isCustomer;
  const isPendingCancel = formData.status === 'cancel_pending';
  const selectedMember = members.find(m => String(m.id) === String(typeof formData.member_id === 'object' ? (formData.member_id as any)?.id : formData.member_id));
  const selectedCar = cars.find(c => String(c.id) === String(typeof formData.car_id === 'object' ? (formData.car_id as any)?.id : formData.car_id));

  const InfoRow: React.FC<{ icon: React.ReactNode, label: string, value: string | React.ReactNode, className?: string, valueClassName?: string }> = ({ icon, label, value, className, valueClassName }) => (
    <div className={clsx("flex flex-col gap-1", className)}>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
        {icon} {label}
      </label>
      <div className={clsx("text-sm font-bold bg-white px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl border border-slate-100 shadow-sm whitespace-pre-wrap", valueClassName || "text-slate-700")}>
        {value || '-'}
      </div>
    </div>
  );

  const isFieldLocked = (fieldName: string) => {
    if (isAdmin) return false;
    if (!id) return false;
    return initialValues[fieldName] !== '' && initialValues[fieldName] !== null && initialValues[fieldName] !== undefined;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-slate-500 font-medium animate-pulse">{t('loading_job_details')}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-4 sm:mx-auto mt-12 p-6 sm:p-8 bg-white rounded-3xl shadow-xl space-y-6 animate-in fade-in zoom-in duration-500 text-center">
        <div className="space-y-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">{t('report_submitted')}</h2>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {t('report_preview')}
          </label>
          <div className="p-4 bg-white rounded-2xl border border-slate-100 max-h-60 overflow-y-auto">
            <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed">
              {generateReportText()}
            </pre>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={() => {
              const reportText = generateReportText();
              navigator.clipboard.writeText(reportText);
              setStatusConfig({
                type: 'success',
                title: t('copied'),
                message: t('report_copied')
              });
              setShowStatusModal(true);
            }}
            className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            {t('copy_report_text')}
          </button>
          <button 
            onClick={() => {
              setSubmitted(false);
              setFormData({
                ...formData,
                customer_name: '',
                origin: '',
                destination: '',
                notes: '',
                mileage_start: formData.mileage_end, // Carry over end mileage as new start
                mileage_end: ''
              });
              setPickupPhotos([]);
              setDeliveryPhotos([]);
              setDocumentPhotos([]);
              setPhotoPreviews([]);
            }}
            className="w-full bg-primary text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-100"
          >
            {t('create_new_report')}
          </button>
          <button 
            onClick={() => navigate(isAdmin ? '/jobs/history' : '/jobs/my')}
            className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
          >
            {t('back_to_all_jobs')}
          </button>
        </div>
      </div>
    );
  }

  if (isCustomer && id) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900">{t('job_details')}</h2>
          </div>
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-white transition-all shadow-sm"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Status Timeline */}
        <StatusTimeline status={formData.status} />

        {/* Driver & Vehicle Card */}
        <div className="bg-white p-5 sm:p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-inner">
              {selectedMember?.picture_url ? (
                <img 
                  src={directusApi.getFileUrl(selectedMember.picture_url)} 
                  alt={selectedMember.display_name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <User className="w-8 h-8" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{t('driver_name')}</p>
              <h3 className="text-lg font-bold text-slate-900">
                {selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}` : t('not_assigned')}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                {formData.phone && (
                  <a 
                    href={`tel:${formData.phone}`}
                    className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                  >
                    <Phone className="w-3 h-3" /> {formData.phone}
                  </a>
                )}
              </div>
            </div>
            {selectedCar?.car_number && (
              <button 
                onClick={() => navigate(`/?vehicle=${selectedCar.car_number}`)}
                className="bg-primary text-white p-4 rounded-2xl shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all"
                title="Track GPS"
              >
                <MapPin className="w-6 h-6" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('car_number')}</p>
              <div className="flex items-center gap-2 text-slate-700">
                <Truck className="w-4 h-4 text-primary" />
                <span className="font-bold">{selectedCar?.car_number || '-'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('vehicle_type')}</p>
              <div className="flex items-center gap-2 text-slate-700">
                <Package className="w-4 h-4 text-primary" />
                <span className="font-bold">{formData.vehicle_type || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Job Details Grid */}
        <div className="bg-white p-5 sm:p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <InfoRow icon={<Hash className="w-3 h-3" />} label={t('case_number')} value={formData.case_number} />
            <InfoRow icon={<Calendar className="w-3 h-3" />} label={t('report_date')} value={formData.work_date.replace('T', ' ')} />
            <InfoRow icon={<Building2 className="w-3 h-3" />} label={t('customer_name')} value={formData.customer_name} />
            <InfoRow icon={<User className="w-3 h-3" />} label={t('contact_name')} value={getFormattedContactName(formData.customer_contact_name, formData.customer_id)} />
            <InfoRow icon={<MapPin className="w-3 h-3 text-emerald-500" />} label={t('origin')} value={formData.origin} />
            <InfoRow icon={<MapPin className="w-3 h-3 text-red-500" />} label={t('destination')} value={formData.destination} />
            {formData.acceptance_deadline && (
              <InfoRow 
                icon={<Clock className="w-3 h-3" />} 
                label={t('acceptance_deadline')} 
                value={new Date(formData.acceptance_deadline).toLocaleString()} 
              />
            )}
            {formData.accepted_at && (
              <InfoRow 
                icon={<CheckCircle2 className="w-3 h-3" />} 
                label={t('accepted_at')} 
                value={new Date(formData.accepted_at).toLocaleString()} 
                valueClassName={formData.acceptance_deadline && new Date(formData.accepted_at) > new Date(formData.acceptance_deadline) ? 'text-red-500' : 'text-green-600'}
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-50">
            <div className="text-center sm:text-left space-y-1">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{t('standby_time')}</p>
              <p className="text-xs font-bold text-slate-700">{formData.standby_time ? new Date(formData.standby_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
            </div>
            <div className="text-center sm:text-left space-y-1">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{t('departure_time')}</p>
              <p className="text-xs font-bold text-slate-700">{formData.departure_time ? new Date(formData.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
            </div>
            <div className="text-center sm:text-left space-y-1">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{t('arrival_time')}</p>
              <p className="text-xs font-bold text-slate-700">{formData.arrival_time ? new Date(formData.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
            </div>
          </div>

          {formData.notes && (
            <div className="pt-6 border-t border-slate-50">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t('notes')}</p>
              <p className="text-sm text-slate-600 italic leading-relaxed bg-white p-4 rounded-2xl">
                "{formData.notes}"
              </p>
            </div>
          )}
        </div>

        {/* Photos Section */}
        {photoPreviews.length > 0 && (
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" /> {t('photos')}
              </h3>
              <span className="text-xs font-bold text-slate-400">{photoPreviews.length} {t('images')}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photoPreviews.map((preview, index) => (
                <div key={index} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 shadow-sm group">
                  <img 
                    src={preview} 
                    alt="Job Photo" 
                    className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform duration-500"
                    onClick={() => setFullscreenImage(preview)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fullscreen Image Preview */}
        {fullscreenImage && (
          <div 
            className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setFullscreenImage(null)}
          >
            <button className="absolute top-6 right-6 p-3 bg-white/10 rounded-full text-white">
              <X className="w-8 h-8" />
            </button>
            <img src={fullscreenImage} alt="Fullscreen" className="max-w-full max-h-full object-contain rounded-lg" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">
            {id ? t('update_job_details') : t('new_job_assignment_title')}
          </h2>
        </div>
        {formData.case_number && (
          <div className="text-sm text-slate-500 font-medium">
            {t('case_number')}: {formData.case_number}
          </div>
        )}
        {id && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Accept Job */}
              {formData.status === 'pending' && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
                  <button 
                    type="button"
                    onClick={handleAcceptJob}
                    disabled={submitting || isJobOverdue}
                    className={clsx(
                      "px-8 py-4 text-white rounded-2xl font-bold transition-all flex items-center gap-2 shadow-lg w-full sm:w-auto justify-center",
                      (submitting || isJobOverdue) ? "bg-slate-400 cursor-not-allowed shadow-none" : "bg-[#007A3E] hover:bg-[#00602F] shadow-green-100"
                    )}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    {isJobOverdue ? t('time_expired') : t('accept_job')}
                  </button>
                  {formData.acceptance_deadline && (
                    <CountdownTimer 
                      deadline={formData.acceptance_deadline} 
                      onOverdue={() => setIsJobOverdue(true)}
                    />
                  )}
                </div>
              )}

              {/* Cancel Job */}
              {isAdmin && formData.status !== 'cancelled' && formData.status !== 'completed' && formData.status !== 'cancel_pending' && (
                <button 
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={submitting}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all flex items-center gap-2 shadow-lg shadow-red-100"
                >
                  <X className="w-4 h-4" />
                  {t('cancel_job')}
                </button>
              )}

              {/* Open New Job */}
              {isAdmin && (formData.status === 'completed' || formData.status === 'cancelled') && (
                <button 
                  type="button"
                  onClick={handleReopenJob}
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all flex items-center gap-2 shadow-lg shadow-amber-100"
                >
                  <Plus className="w-4 h-4" />
                  {t('reopen_job')}
                </button>
              )}

              {/* Delete */}
              {isAdmin && id && formData.status !== 'cancelled' && (
                <button 
                  type="button"
                  onClick={handleDeleteJob}
                  disabled={submitting}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all flex items-center gap-2 shadow-lg shadow-red-100"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('delete_job')}
                </button>
              )}

              {/* Revert */}
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2 bg-slate-200 text-slate-800 rounded-xl font-bold hover:bg-slate-300 transition-all flex items-center gap-2"
              >
                {t('back')}
              </button>

            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {id && <StatusTimeline status={formData.status} />}

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold border border-red-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}
        {/* Cancellation Reason Section */}
        {formData.cancel_reason && (
          <div className="bg-red-50 p-5 sm:p-6 rounded-3xl border border-red-100 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-bold text-red-800">{t('cancel_reason')}</h3>
            </div>
            <p className="text-red-700 bg-white/50 p-4 rounded-2xl border border-red-200">
              {formData.cancel_reason}
            </p>
          </div>
        )}

        {/* Basic Info Section */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-slate-800">{t('job_details')}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Hash className="w-4 h-4" /> {t('case_number')}
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  disabled={true}
                  placeholder={t('case_number')}
                  value={formData.case_number || ''}
                  onChange={e => setFormData({...formData, case_number: e.target.value})}
                  className={clsx(
                    "flex-1 px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                    "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                  )}
                />
                <button
                  type="button"
                  onClick={handleCopyCaseNumber}
                  className={clsx(
                    "px-4 py-3 border rounded-2xl transition-all flex items-center justify-center",
                    copied ? "bg-green-50 border-green-200 text-green-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                  title={t('copy_to_clipboard')}
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> {t('report_date')}
              </label>
              <input 
                type="datetime-local" 
                lang="th-TH"
                required
                disabled={!!id && !isAdmin}
                value={formData.work_date || ''}
                onChange={async (e) => {
                  const newDate = e.target.value;
                  setFormData(prev => ({ ...prev, work_date: newDate }));
                }}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-white border-slate-200 focus:bg-white"
                )}
              />
            </div>

            {/* Scheduling Toggle */}
            {(!id || isAdmin) && (
              <div className="col-span-1 md:col-span-2 lg:col-span-3">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                       <Clock className="w-4 h-4 text-primary" /> {t('schedule_job')}
                    </h4>
                    <p className="text-xs text-slate-500">{t('schedule_job_desc') || 'Enable advance scheduling and notifications'}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={showScheduling}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setShowScheduling(enabled);
                        if (!enabled) {
                          setFormData(prev => ({
                            ...prev,
                            advance_opening_time: '',
                            notify_driver_24h_before: false
                          }));
                        }
                      }}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            )}

            {/* Conditional Scheduling Fields */}
            {showScheduling && (!id || isAdmin) && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> {t('advance_opening_time')}
                  </label>
                  <input 
                    type="datetime-local" 
                    lang="th-TH"
                    disabled={!!id && !isAdmin}
                    value={formData.advance_opening_time || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, advance_opening_time: e.target.value }))}
                    className={clsx(
                      "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                      (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-white border-slate-200 focus:bg-white"
                    )}
                  />
                  <p className="text-[10px] text-slate-500 mt-1 italic">{t('advance_opening_desc')}</p>
                </div>

                <div className="flex items-center gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 md:col-span-2">
                  <input
                    id="notify_24h"
                    type="checkbox"
                    disabled={!!id && !isAdmin}
                    checked={formData.notify_driver_24h_before || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, notify_driver_24h_before: e.target.checked }))}
                    className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <div className="flex flex-col">
                    <label htmlFor="notify_24h" className="text-sm font-bold text-slate-700 cursor-pointer">
                      {t('notify_driver_24h_before')}
                    </label>
                    <span className="text-xs text-slate-500">{t('notify_driver_24h_desc')}</span>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> {t('customer_name')}
              </label>
              <Select
                isDisabled={!!id && !isAdmin}
                className="react-select-container"
                classNamePrefix="react-select"
                placeholder={t('select_customer')}
                options={customers.map(c => ({ value: c.company_name, label: c.company_name, data: c }))}
                value={formData.customer_name ? { value: formData.customer_name, label: formData.customer_name } : null}
                onChange={(option: any) => {
                  const customerName = option?.value || '';
                  const selectedCustomerLoc = option?.data;
                  
                  // Format contact name with LINE name and real name if linked members exist
                  let formattedContactName = '';
                  if (selectedCustomerLoc) {
                    const memberIds = getCustomerMemberIds(selectedCustomerLoc);

                    if (memberIds.length > 0) {
                      const selectedMembers = members.filter(m => memberIds.includes(String(m.id)));
                      
                      formattedContactName = selectedMembers.map((m, idx) => {
                        const lineName = m.display_name || '';
                        const realName = `${m.first_name || ''} ${m.last_name || ''}`.trim();
                        
                        if (lineName && realName && lineName !== realName) {
                          return `${idx + 1}. ${realName} (${lineName})`;
                        } else if (realName) {
                          return `${idx + 1}. ${realName}`;
                        } else if (lineName) {
                          return `${idx + 1}. ${lineName}`;
                        }
                        return `${idx + 1}. -`;
                      }).join('\n');
                    } else if (customerName) {
                      formattedContactName = t('no_contact_found');
                    }
                  }

                  setFormData(prev => ({
                    ...prev, 
                    customer_name: customerName,
                    customer_id: selectedCustomerLoc?.id || '',
                    customer_contact_name: formattedContactName,
                    customer_contact_phone: selectedCustomerLoc?.phone || '',
                    case_number: !id ? generateCaseNumber(selectedCustomerLoc?.company_code || 'TH') : prev.case_number
                  }));
                  
                  // Auto-fill origin if empty
                  if (selectedCustomerLoc?.address && !formData.origin) {
                    setFormData(prev => ({ ...prev, origin: selectedCustomerLoc.address }));
                  }
                  
                  // Auto-fill car if there's only one car assigned to this customer
                  if (isAdmin && customerName && selectedCustomerLoc) {
                    let matchingMember = null;
                    
                    // Priority 1: Use the direct member_id link or members array
                    const memberIds: string[] = [];
                    const primaryId = typeof selectedCustomerLoc.member_id === 'object' ? selectedCustomerLoc.member_id?.id : selectedCustomerLoc.member_id;
                    if (primaryId) memberIds.push(String(primaryId));
                    
                    if (selectedCustomerLoc.members && Array.isArray(selectedCustomerLoc.members)) {
                      selectedCustomerLoc.members.forEach((m: any) => {
                        const id = typeof m.line_user_id === 'object' ? m.line_user_id?.id : m.line_user_id;
                        if (id && !memberIds.includes(String(id))) {
                          memberIds.push(String(id));
                        }
                      });
                    }

                    if (memberIds.length > 0) {
                      // Find cars assigned to any of these members
                      const assignedCars = cars.filter(car => 
                        car.car_users?.some((cu: any) => {
                          const cuId = typeof cu.line_user_id === 'object' ? cu.line_user_id.id : cu.line_user_id;
                          return memberIds.includes(String(cuId));
                        })
                      );

                      if (assignedCars.length === 1) {
                        setFormData(prev => ({
                          ...prev, 
                          car_id: assignedCars[0].id,
                          vehicle_type: assignedCars[0].vehicle_type || ''
                        }));
                        matchingMember = members.find(m => String(m.id) === String(memberIds[0]));
                      } else if (assignedCars.length > 1) {
                        // If multiple cars, maybe don't auto-select or select first
                        console.log('Multiple cars found for linked members:', assignedCars.map(c => c.car_number));
                      }
                    }
                  }
                }}
                styles={{
                  control: (base) => ({
                    ...base,
                    borderRadius: '1rem',
                    padding: '0.25rem',
                    backgroundColor: (!!id && !isAdmin) ? '#f1f5f9' : '#f8fafc',
                    border: '1px solid #e2e8f0',
                    boxShadow: 'none',
                    '&:hover': {
                      border: '1px solid #cbd5e1'
                    }
                  }),
                  menu: (base) => ({
                    ...base,
                    borderRadius: '1rem',
                    overflow: 'hidden',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  })
                }}
              />
              {(() => {
                const currentCustomerId = typeof formData.customer_id === 'object' ? (formData.customer_id as any).id : formData.customer_id;
                const cust = customers.find(c => String(c.id) === String(currentCustomerId));
                if (!cust) return null;

                const memberIds: string[] = [];
                const primaryId = typeof cust.member_id === 'object' ? cust.member_id?.id : cust.member_id;
                if (primaryId) memberIds.push(String(primaryId));
                
                if (cust.members && Array.isArray(cust.members)) {
                  cust.members.forEach((m: any) => {
                    const id = typeof m.line_user_id === 'object' ? m.line_user_id?.id : m.line_user_id;
                    if (id && !memberIds.includes(String(id))) {
                      memberIds.push(String(id));
                    }
                  });
                }

                if (memberIds.length === 0) return null;

                return (
                  <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {t('linked_to_line')}: {
                      (() => {
                        const selectedMembers = members.filter(m => memberIds.includes(m.id));
                        return selectedMembers.map(m => m.display_name || `${m.first_name} ${m.last_name}`).join(', ');
                      })()
                    }
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4" /> {t('contact_name')}
              </label>
              <textarea 
                rows={2}
                disabled={!!id && !isAdmin}
                placeholder={t('contact_name')}
                value={formData.customer_contact_name || ''}
                onChange={e => setFormData({...formData, customer_contact_name: e.target.value})}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all resize-none",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-white border-slate-200 focus:bg-white"
                )}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Phone className="w-4 h-4" /> {t('contact_phone')}
              </label>
              <input 
                type="text" 
                disabled={!!id && !isAdmin}
                placeholder={t('contact_phone')}
                value={formData.customer_contact_phone || ''}
                onChange={e => setFormData({...formData, customer_contact_phone: e.target.value})}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-white border-slate-200 focus:bg-white"
                )}
              />
            </div>
          </div>

          {/* Routes Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary" /> {t('travel_route')} ({formData.routes.length})
              </h4>
              {(!id || isAdmin) && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      routes: [
                        ...formData.routes,
                        {
                          type: 'return',
                          status: 'pending' as 'pending' | 'completed',
                          date: new Date().toISOString().split('T')[0],
                          standby_time: '',
                          departure_time: '',
                          arrival_time: '',
                          mileage_start: '',
                          mileage_end: '',
                          pickups: [{ name: '', url: '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }],
                          deliveries: [{ name: '', url: '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }],
                          distance: undefined,
                          origin: '',
                          origin_url: '',
                          origin_lat: undefined,
                          origin_lng: undefined,
                          destination: '',
                          destination_url: '',
                          destination_lat: undefined,
                          destination_lng: undefined,
                          route_type: undefined
                        }
                      ]
                    });
                  }}
                  className="text-xs font-bold text-primary hover:text-primary-dark flex items-center gap-1 px-3 py-1.5 bg-primary/10 rounded-lg transition-colors"
                >
                  <Plus className="w-3 h-3" /> {t('add_route')}
                </button>
              )}
            </div>

            <div className="space-y-4">
              {formData.routes.map((route, index) => (
                <div key={index} className="p-4 sm:p-6 bg-white rounded-3xl border border-slate-200 shadow-sm relative group transition-all hover:border-primary/30">
                  {(!id || isAdmin) && index > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newRoutes = formData.routes.filter((_, i) => i !== index);
                        setFormData({ ...formData, routes: newRoutes });
                      }}
                      className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md z-10 sm:opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                      {index + 1}
                    </div>
                    <span className="font-bold text-slate-700">{t('route_index', { index: index + 1 })}</span>
                    
                    {/* Route Time & Mileage */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mt-4 p-3 sm:p-4 bg-slate-50 rounded-2xl border border-slate-100 w-full">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {t('date')}
                        </label>
                        <input 
                          type="date"
                          lang="th-TH"
                          disabled={!isEditable}
                          value={route.date || ''}
                          onChange={e => {
                            const newRoutes = [...formData.routes];
                            newRoutes[index].date = e.target.value;
                            setFormData({ ...formData, routes: newRoutes });
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {t('standby_time')}
                        </label>
                        <input 
                          type="datetime-local"
                          lang="th-TH"
                          disabled={!isEditable}
                          value={route.standby_time || ''}
                          onChange={e => {
                            const newRoutes = [...formData.routes];
                            newRoutes[index].standby_time = e.target.value;
                            setFormData({ ...formData, routes: newRoutes });
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {t('departure_time')}
                        </label>
                        <input 
                          type="datetime-local"
                          lang="th-TH"
                          disabled={!isEditable}
                          value={route.departure_time || ''}
                          onChange={e => {
                            const newRoutes = [...formData.routes];
                            newRoutes[index].departure_time = e.target.value;
                            setFormData({ ...formData, routes: newRoutes });
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {t('arrival_time')}
                        </label>
                        <input 
                          type="datetime-local"
                          lang="th-TH"
                          disabled={!isEditable}
                          value={route.arrival_time || ''}
                          onChange={e => {
                            const newRoutes = [...formData.routes];
                            newRoutes[index].arrival_time = e.target.value;
                            setFormData({ ...formData, routes: newRoutes });
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <Gauge className="w-3 h-3" /> {t('mileage_start')}
                        </label>
                        <input 
                          type="number"
                          disabled={!isEditable}
                          placeholder="0"
                          value={route.mileage_start || ''}
                          onChange={e => {
                            const newRoutes = [...formData.routes];
                            newRoutes[index].mileage_start = e.target.value;
                            setFormData({ ...formData, routes: newRoutes });
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <Gauge className="w-3 h-3" /> {t('mileage_end')}
                        </label>
                        <input 
                          type="number"
                          disabled={!isEditable}
                          placeholder="0"
                          value={route.mileage_end || ''}
                          onChange={e => {
                            const newRoutes = [...formData.routes];
                            newRoutes[index].mileage_end = e.target.value;
                            setFormData({ ...formData, routes: newRoutes });
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary" /> {t('estimated_distance')}
                        </label>
                        <div className="flex gap-2">
                          <input 
                            type="number"
                            disabled={!isEditable}
                            placeholder="0"
                            value={route.distance || ''}
                            onChange={e => {
                              const newRoutes = [...formData.routes];
                              newRoutes[index].distance = parseFloat(e.target.value) || 0;
                              // Update total estimated distance automatically
                              const total = newRoutes.reduce((sum, r) => sum + (r.distance || 0), 0);
                              setFormData({ 
                                ...formData, 
                                routes: newRoutes,
                                estimated_distance: Math.round(total * 10) / 10
                              });
                            }}
                            className="flex-1 px-3 py-2 bg-blue-50/50 border border-blue-100 rounded-xl text-xs font-bold text-blue-700 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                          {isEditable && (
                            <button
                              type="button"
                              onClick={() => handleCalculateRouteDistance(index)}
                              className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                              title={t('search_location')}
                            >
                              <RefreshCw className={clsx("w-4 h-4", isCalculatingDistance && "animate-spin")} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <Truck className="w-3 h-3" /> {t('distance')} ({t('mileage')})
                        </label>
                        <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                          {(() => {
                            const start = parseFloat(route.mileage_start || '0');
                            const end = parseFloat(route.mileage_end || '0');
                            return (!isNaN(start) && !isNaN(end) && end >= start) ? (end - start).toLocaleString() : '0';
                          })()} km
                        </div>
                      </div>

                      {/* Mileage Warning for first route */}
                      {index === 0 && formData.car_id && route.mileage_start && parseFloat(route.mileage_start.toString()) < getLastMileage(formData.car_id) && (
                        <div className="col-span-1 md:col-span-2 lg:col-span-3 p-3 bg-red-50 rounded-xl border border-red-100 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-bold text-red-800">{t('mileage_error')}</p>
                            <p className="text-[9px] text-red-700">
                              {t('mileage_less_than_previous', { mileage: getLastMileage(formData.car_id) })}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {index < formData.routes.length - 1 && (
                      <div className="flex justify-center -my-3 relative z-10">
                        <div className="bg-primary/5 p-2 rounded-full border border-primary/20 backdrop-blur-sm">
                          <ChevronDown className="w-4 h-4 text-primary animate-bounce-slow" />
                        </div>
                      </div>
                    )}
                  </div>

                    <div className="grid grid-cols-1 gap-6">
                      {/* Pickups */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-slate-700 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-primary" /> {t('pickup_points')}
                          </h5>
                          {(!id || isAdmin) && (
                            <button
                              type="button"
                              onClick={() => {
                                const newRoutes = [...formData.routes];
                                newRoutes[index].pickups = [...(newRoutes[index].pickups || []), { name: '', url: '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }];
                                setFormData({ ...formData, routes: newRoutes });
                              }}
                              className="text-xs text-primary hover:text-primary-dark font-medium flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> {t('add_pickup')}
                            </button>
                          )}
                        </div>
                        
                        {(route.pickups || [{ name: route.origin || '', url: route.origin_url || '', contact_name: '', contact_phone: '', time: '' }]).map((pickup: any, pIndex: number) => (
                          <div key={`pickup-${pIndex}`} className="p-3 sm:p-4 bg-white rounded-2xl border border-slate-200 relative group">
                            {(!id || isAdmin) && (route.pickups?.length > 1) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newRoutes = [...formData.routes];
                                  newRoutes[index].pickups = newRoutes[index].pickups.filter((_: any, i: number) => i !== pIndex);
                                  setFormData({ ...formData, routes: newRoutes });
                                }}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm z-10 sm:opacity-0 group-hover:opacity-100"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{t('location_name_pickup', { index: pIndex + 1 })}</label>
                <input 
                  type="text" 
                  required
                  disabled={!!id && !isAdmin}
                  placeholder={t('enter_location_placeholder')}
                  value={pickup.name || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const newRoutes = [...formData.routes];
                    if (!newRoutes[index].pickups) newRoutes[index].pickups = [{ name: route.origin || '', url: route.origin_url || '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }];
                    newRoutes[index].pickups[pIndex].name = val;
                    if (pIndex === 0) newRoutes[index].origin = val;
                    setFormData({ ...formData, routes: newRoutes });
                  }}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-slate-50/50 focus:bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{t('google_map_url')}</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="text" 
                    required
                    disabled={!!id && !isAdmin}
                    placeholder={t('enter_google_map_link')}
                    value={pickup.url || ''}
                    onChange={e => {
                      const val = e.target.value;
                      const newRoutes = [...formData.routes];
                      if (!newRoutes[index].pickups) newRoutes[index].pickups = [{ name: route.origin || '', url: route.origin_url || '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }];
                      newRoutes[index].pickups[pIndex].url = val;
                      if (pIndex === 0) newRoutes[index].origin_url = val;
                      setFormData({ ...formData, routes: newRoutes });
                    }}
                    className="flex-1 px-4 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-slate-50/50 focus:bg-white min-w-0"
                  />
                  {pickup.url && pickup.url.startsWith('http') && (
                    <button
                      type="button"
                      onClick={() => window.open(pickup.url, '_blank')}
                      className="px-6 py-3 bg-primary text-white rounded-2xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-sm active:scale-95 whitespace-nowrap"
                    >
                      <Navigation className="w-4 h-4" />
                      {t('navigate')}
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{t('contact_name_optional')}</label>
                <input 
                  type="text" 
                  disabled={!!id && !isAdmin}
                  placeholder={t('contact_name')}
                  value={pickup.contact_name || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const newRoutes = [...formData.routes];
                    if (!newRoutes[index].pickups) newRoutes[index].pickups = [{ name: route.origin || '', url: route.origin_url || '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }];
                    newRoutes[index].pickups[pIndex].contact_name = val;
                    setFormData({ ...formData, routes: newRoutes });
                  }}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-slate-50/50 focus:bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{t('phone_optional')}</label>
                <input 
                  type="text" 
                  disabled={!!id && !isAdmin}
                  placeholder={t('contact_phone')}
                  value={pickup.contact_phone || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const newRoutes = [...formData.routes];
                    if (!newRoutes[index].pickups) newRoutes[index].pickups = [{ name: route.origin || '', url: route.origin_url || '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }];
                    newRoutes[index].pickups[pIndex].contact_phone = val;
                    setFormData({ ...formData, routes: newRoutes });
                  }}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-slate-50/50 focus:bg-white"
                />
              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500">{t('appointment_time')}</label>
                                <input 
                                  type="datetime-local" 
                                  lang="th-TH"
                                  disabled={!!id && !isAdmin}
                                  value={pickup.time || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    const newRoutes = [...formData.routes];
                                    if (!newRoutes[index].pickups) newRoutes[index].pickups = [{ name: route.origin || '', url: route.origin_url || '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }];
                                    newRoutes[index].pickups[pIndex].time = val;
                                    setFormData({ ...formData, routes: newRoutes });
                                  }}
                                  className="w-full px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all text-sm bg-white"
                                />
                              </div>

                              {/* Photos for Pickup Point */}
                              {id && (formData.status === 'accepted' || formData.status === 'completed') && (
                                <div className="md:col-span-2 pt-2 border-t border-slate-100">
                                  {renderPhotoSection(
                                    t('photo_document'),
                                    pointPhotosMap[`r-${index}-p-${pIndex}`] || [],
                                    pickup.photos || [],
                                    'pickup',
                                    (e) => handlePointPhotoChange(e, `r-${index}-p-${pIndex}`),
                                    (i) => removePointPhoto(`r-${index}-p-${pIndex}`, i),
                                    (i) => removePointExistingPhoto(index, pIndex, i, 'pickup'),
                                    processingPhotos,
                                    `r-${index}-p-${pIndex}`
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Deliveries */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-slate-700 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-red-500" /> {t('delivery_points')}
                          </h5>
                          {(!id || isAdmin) && (
                            <button
                              type="button"
                              onClick={() => {
                                const newRoutes = [...formData.routes];
                                newRoutes[index].deliveries = [...(newRoutes[index].deliveries || []), { name: '', url: '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }];
                                setFormData({ ...formData, routes: newRoutes });
                              }}
                              className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> {t('add_delivery')}
                            </button>
                          )}
                        </div>
                        
                        {(route.deliveries || [{ name: route.destination || '', url: route.destination_url || '', contact_name: '', contact_phone: '', time: '' }]).map((delivery: any, dIndex: number) => (
                          <div key={`delivery-${dIndex}`} className="p-3 sm:p-4 bg-white rounded-2xl border border-slate-200 relative group">
                            {(!id || isAdmin) && (route.deliveries?.length > 1) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newRoutes = [...formData.routes];
                                  newRoutes[index].deliveries = newRoutes[index].deliveries.filter((_: any, i: number) => i !== dIndex);
                                  setFormData({ ...formData, routes: newRoutes });
                                }}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm z-10 sm:opacity-0 group-hover:opacity-100"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{t('location_name_delivery', { index: dIndex + 1 })}</label>
                <input 
                  type="text" 
                  required
                  disabled={!!id && !isAdmin}
                  placeholder={t('enter_location_placeholder')}
                  value={delivery.name || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const newRoutes = [...formData.routes];
                    if (!newRoutes[index].deliveries) newRoutes[index].deliveries = [{ name: route.destination || '', url: route.destination_url || '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }];
                    newRoutes[index].deliveries[dIndex].name = val;
                    if (dIndex === newRoutes[index].deliveries.length - 1) newRoutes[index].destination = val;
                    setFormData({ ...formData, routes: newRoutes });
                  }}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-slate-50/50 focus:bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{t('google_map_url')}</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="text" 
                    required
                    disabled={!!id && !isAdmin}
                    placeholder={t('enter_google_map_link')}
                    value={delivery.url || ''}
                    onChange={e => {
                      const val = e.target.value;
                      const newRoutes = [...formData.routes];
                      if (!newRoutes[index].deliveries) newRoutes[index].deliveries = [{ name: route.destination || '', url: route.destination_url || '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }];
                      newRoutes[index].deliveries[dIndex].url = val;
                      if (dIndex === newRoutes[index].deliveries.length - 1) newRoutes[index].destination_url = val;
                      setFormData({ ...formData, routes: newRoutes });
                    }}
                    className="flex-1 px-4 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-slate-50/50 focus:bg-white min-w-0"
                  />
                  {delivery.url && delivery.url.startsWith('http') && (
                    <button
                      type="button"
                      onClick={() => window.open(delivery.url, '_blank')}
                      className="px-6 py-3 bg-primary text-white rounded-2xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-sm active:scale-95 whitespace-nowrap"
                    >
                      <Navigation className="w-4 h-4" />
                      {t('navigate')}
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{t('contact_name_optional')}</label>
                <input 
                  type="text" 
                  disabled={!!id && !isAdmin}
                  placeholder={t('contact_name')}
                  value={delivery.contact_name || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const newRoutes = [...formData.routes];
                    if (!newRoutes[index].deliveries) newRoutes[index].deliveries = [{ name: route.destination || '', url: route.destination_url || '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }];
                    newRoutes[index].deliveries[dIndex].contact_name = val;
                    setFormData({ ...formData, routes: newRoutes });
                  }}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-slate-50/50 focus:bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{t('phone_optional')}</label>
                <input 
                  type="text" 
                  disabled={!!id && !isAdmin}
                  placeholder={t('contact_phone')}
                  value={delivery.contact_phone || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const newRoutes = [...formData.routes];
                    if (!newRoutes[index].deliveries) newRoutes[index].deliveries = [{ name: route.destination || '', url: route.destination_url || '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }];
                    newRoutes[index].deliveries[dIndex].contact_phone = val;
                    setFormData({ ...formData, routes: newRoutes });
                  }}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-slate-50/50 focus:bg-white"
                />
              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500">{t('appointment_time')}</label>
                                <input 
                                  type="datetime-local" 
                                  lang="th-TH"
                                  disabled={!!id && !isAdmin}
                                  value={delivery.time || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    const newRoutes = [...formData.routes];
                                    if (!newRoutes[index].deliveries) newRoutes[index].deliveries = [{ name: route.destination || '', url: route.destination_url || '', contact_name: '', contact_phone: '', time: '', photos: [] as string[] }];
                                    newRoutes[index].deliveries[dIndex].time = val;
                                    setFormData({ ...formData, routes: newRoutes });
                                  }}
                                  className="w-full px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all text-sm bg-white"
                                />
                              </div>

                              {/* Photos for Delivery Point */}
                              {id && (formData.status === 'accepted' || formData.status === 'completed') && (
                                <div className="md:col-span-2 pt-2 border-t border-slate-100">
                                  {renderPhotoSection(
                                    t('photo_document'),
                                    pointPhotosMap[`r-${index}-d-${dIndex}`] || [],
                                    delivery.photos || [],
                                    'delivery',
                                    (e) => handlePointPhotoChange(e, `r-${index}-d-${dIndex}`),
                                    (i) => removePointPhoto(`r-${index}-d-${dIndex}`, i),
                                    (i) => removePointExistingPhoto(index, dIndex, i, 'delivery'),
                                    processingPhotos,
                                    `r-${index}-d-${dIndex}`
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {id && (formData.status === 'accepted' || (isAdmin && formData.status !== 'completed')) && (
                      <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                      {route.status === 'completed' ? (
                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-sm border border-emerald-100 italic">
                          <CheckCircle2 className="w-4 h-4" />
                          {t('delivery_successful_per_route')}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCompleteRoute(index)}
                          disabled={isUpdatingRouteStatus}
                          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 active:scale-95 disabled:opacity-50"
                        >
                          {isUpdatingRouteStatus ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          {t('delivery_successful_per_route')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
            {(!id || isAdmin) && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleCalculateDistance}
                    disabled={isCalculatingDistance || formData.routes.some(r => {
                      const points = [
                        ...(r.pickups || []).filter(p => p.url),
                        ...(r.deliveries || []).filter(d => d.url)
                      ];
                      return points.length < 2 && (!r.origin_url || !r.destination_url);
                    })}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    {isCalculatingDistance ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> {t('calculating')}</>
                    ) : (
                      <><MapPin className="w-4 h-4" /> {t('calculate_distance')}</>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleOptimizeRoute}
                    disabled={isCalculatingDistance || formData.routes.some(r => {
                      const points = [
                        ...(r.pickups || []).filter(p => p.url),
                        ...(r.deliveries || []).filter(d => d.url)
                      ];
                      return points.length < 3;
                    })}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    {isCalculatingDistance ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> {t('calculating')}</>
                    ) : (
                      <><Truck className="w-4 h-4" /> {t('optimize_route')}</>
                    )}
                  </button>
                </div>
              </div>
            )}
            
            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {t('estimated_distance')} ({t('km')})
                </label>
                {formData.estimated_distance !== undefined && formData.estimated_distance > 0 && (
                  <span className={clsx(
                    "text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase tracking-wider",
                    formData.estimated_distance > parseInt(localStorage.getItem('bkk_max_distance') || '250', 10)
                      ? "bg-purple-50 text-purple-600 border-purple-100"
                      : "bg-blue-50 text-blue-600 border-blue-100"
                  )}>
                    {formData.estimated_distance > parseInt(localStorage.getItem('bkk_max_distance') || '250', 10) ? t('upcountry') : t('bangkok_vicinity')}
                  </span>
                )}
              </div>
              <input
                type="number"
                step="0.1"
                disabled={!!id && !isAdmin}
                value={formData.estimated_distance !== undefined ? formData.estimated_distance : ''}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_distance: parseFloat(e.target.value) || undefined }))}
                placeholder="0.0"
                className={clsx(
                  "w-full px-4 py-2.5 rounded-xl border transition-all outline-none font-medium",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-white border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                )}
              />
            </div>
          </div>
        </div>

        {/* Vehicle & Driver Section */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Truck className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="font-bold text-slate-800">{t('vehicles')} {t('and')} {t('drivers')}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Truck className="w-4 h-4" /> {t('car_number')}
                </label>
                {(!formData.estimated_distance || formData.estimated_distance === 0) && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                    {t('calculate_distance_hint')}
                  </span>
                )}
              </div>
              <Select
                isDisabled={!!id && !isAdmin}
                className="react-select-container"
                classNamePrefix="react-select"
                placeholder={t('select_vehicle')}
                options={filteredCars
                  .filter(car => car.maintenance_status !== 'maintenance')
                  .map(car => {
                  const assignedNames = car.car_users?.map((cu: any) => {
                    const user = cu.line_user_id;
                    if (!user) return null;
                    const name = user.display_name || (user.first_name ? `${user.first_name} ${user.last_name}` : null);
                    return name;
                  }).filter(Boolean).join(', ');
                  const driverName = assignedNames || car.owner_name || '';
                  const vehicleType = car.vehicle_type ? ` [${car.vehicle_type}]` : '';
                  
                  let queueLabel = '';
                  if ((car as any)._queue) {
                    const q = (car as any)._queue;
                    const recommendationStr = q.recommendation === 'upcountry' 
                      ? t('should_get_upcountry_job') 
                      : q.recommendation === 'bkk' 
                        ? t('should_get_bkk_job') 
                        : t('normal_status');
                    
                    queueLabel = ` [${recommendationStr}]`;
                  }

                  return {
                    value: car.id,
                    label: `${car.car_number}${vehicleType} ${driverName ? `(${driverName})` : ''}${queueLabel}`,
                    data: car
                  };
                })}
                value={formData.car_id ? { 
                  value: typeof formData.car_id === 'object' ? (formData.car_id as any)?.id : formData.car_id, 
                  label: cars.find(c => String(c.id) === String(typeof formData.car_id === 'object' ? (formData.car_id as any)?.id : formData.car_id))?.car_number || 
                         (typeof formData.car_id === 'object' ? (formData.car_id as any)?.car_number : formData.car_id)
                } : null}
                onChange={(option: any) => {
                  const carId = option?.value || '';
                  const selectedCar = option?.data;
                  if (selectedCar?.maintenance_status === 'maintenance') {
                    setError(t('car_under_maintenance'));
                    setFormData(prev => ({...prev, car_id: '', vehicle_type: '', current_mileage: undefined, next_maintenance_date: undefined, next_maintenance_mileage: undefined}));
                    return;
                  }
                  setError('');
                  setFormData(prev => {
                    const nextData = {
                      ...prev, 
                      car_id: carId, 
                      vehicle_type: selectedCar?.vehicle_type || '',
                      current_mileage: selectedCar?.current_mileage,
                      next_maintenance_date: selectedCar?.next_maintenance_date,
                      next_maintenance_mileage: selectedCar?.next_maintenance_mileage
                    };

                    // Auto-fill driver based on car assignment
                    let autoFilledDriverId = null;
                    if (carId) {
                      // Priority 1: Static assignment in Car settings (from คลังยานพาหนะ)
                      if (selectedCar && selectedCar.car_users) {
                        // Try to find a member with driver-like role first
                        let driverMember = selectedCar.car_users.find((cu: any) => {
                          const user = cu.line_user_id;
                          const role = typeof user === 'object' ? user.role : '';
                          return user && (role === 'member' || role === 'driver' || role === 'staff');
                        })?.line_user_id;

                        // Fallback: Find any member that is not a customer
                        if (!driverMember) {
                          driverMember = selectedCar.car_users.find((cu: any) => {
                            const user = cu.line_user_id;
                            const role = typeof user === 'object' ? user.role : '';
                            return user && role !== 'customer';
                          })?.line_user_id;
                        }
                        
                        if (driverMember) {
                          autoFilledDriverId = typeof driverMember === 'object' ? driverMember.id : driverMember;
                        }
                      }

                      // Priority 1.5: Match by owner_name if car_users didn't work
                      if (!autoFilledDriverId && selectedCar?.owner_name) {
                        const ownerName = selectedCar.owner_name.trim().toLowerCase();
                        const matchingMember = members.find(m => {
                          const fullName = `${m.first_name} ${m.last_name}`.trim().toLowerCase();
                          const displayName = (m.display_name || '').toLowerCase();
                          return fullName === ownerName || 
                                 displayName === ownerName || 
                                 fullName.includes(ownerName) || 
                                 ownerName.includes(fullName);
                        });
                        if (matchingMember) {
                          autoFilledDriverId = matchingMember.id;
                        }
                      }

                      // Priority 2: Last driver from previous reports (History) if no static assignment
                      if (!autoFilledDriverId) {
                        const lastDriverId = getLastDriver(carId);
                        if (lastDriverId) {
                          autoFilledDriverId = lastDriverId;
                        }
                      }

                      if (autoFilledDriverId) {
                        const driver = members.find(m => String(m.id) === String(autoFilledDriverId));
                        if (driver) {
                          nextData.member_id = String(autoFilledDriverId);
                          nextData.phone = driver.phone || nextData.phone;
                        }
                      } else if (isAdmin) {
                        // If no driver assigned to car and we are admin, clear member_id 
                        // so they know no one is assigned
                        nextData.member_id = '';
                        nextData.phone = '';
                      }
                    } else if (isAdmin) {
                      // If car is cleared and we are admin, also clear driver
                      nextData.member_id = '';
                      nextData.phone = '';
                    }
                    
                    return nextData;
                  });
                  
                  // Auto-fill customer if car is assigned to a customer
                  if (isAdmin && carId && selectedCar && selectedCar.car_users) {
                    const customerMember = selectedCar.car_users.find((cu: any) => {
                      const user = cu.line_user_id;
                      return user && (typeof user === 'object' ? user.role === 'customer' : false);
                    })?.line_user_id as Member | undefined;

                    if (customerMember) {
                      const matchingCustomer = customers.find(c => 
                        (customerMember.email && c.email && customerMember.email.toLowerCase() === c.email.toLowerCase()) ||
                        (customerMember.phone && c.phone && customerMember.phone.replace(/\D/g, '') === c.phone.replace(/\D/g, '')) ||
                        (c.company_name.toLowerCase().includes(customerMember.first_name.toLowerCase()) && customerMember.first_name.length > 2)
                      );
                      if (matchingCustomer) {
                        setFormData(prev => ({...prev, customer_name: matchingCustomer.company_name}));
                      }
                    }
                  }
                }}
                styles={{
                  control: (base) => ({
                    ...base,
                    borderRadius: '1rem',
                    padding: '0.25rem',
                    backgroundColor: (!!id && !isAdmin) ? '#f1f5f9' : '#f8fafc',
                    border: '1px solid #e2e8f0',
                    boxShadow: 'none',
                    '&:hover': {
                      border: '1px solid #cbd5e1'
                    }
                  }),
                  menu: (base) => ({
                    ...base,
                    borderRadius: '1rem',
                    overflow: 'hidden',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  })
                }}
              />
              {formData.car_id && (
                <div className="mt-2 p-3 bg-white rounded-xl text-xs text-slate-600 space-y-2 border border-slate-100 shadow-sm">
                  {(() => {
                    const carId = typeof formData.car_id === 'object' ? (formData.car_id as any)?.id : formData.car_id;
                    const selectedCar = filteredCars.find(c => String(c.id) === String(carId));
                    const isQueueEnabled = localStorage.getItem('enable_queue_system') !== 'false';
                    const q = (selectedCar as any)?._queue;
                    
                    if (!isQueueEnabled || !q) return null;

                    const getRecommendationBadge = (recommendation: string) => {
                      switch (recommendation) {
                        case 'upcountry':
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                              <ArrowUpRight className="w-3 h-3" />
                              {t('should_get_upcountry_job')}
                            </span>
                          );
                        case 'bkk':
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                              <ArrowDownRight className="w-3 h-3" />
                              {t('should_get_bkk_job')}
                            </span>
                          );
                        default:
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">
                              <Minus className="w-3 h-3" />
                              {t('normal_status')}
                            </span>
                          );
                      }
                    };

                    return (
                      <div className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                        <span className="font-semibold text-slate-500">{t('next_queue_status')}:</span>
                        {getRecommendationBadge(q.recommendation)}
                      </div>
                    );
                  })()}
                  <div className="flex justify-between py-1 border-b border-slate-50 last:border-0">
                    <span className="font-semibold text-slate-500">{t('current_mileage')}:</span>
                    <span className="font-bold text-slate-800">{formData.current_mileage || '-'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50 last:border-0">
                    <span className="font-semibold text-slate-500">{t('next_maintenance_date')}:</span>
                    <span className="font-bold text-slate-800">{formData.next_maintenance_date ? new Date(formData.next_maintenance_date).toLocaleDateString() : '-'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50 last:border-0">
                    <span className="font-semibold text-slate-500">{t('next_maintenance_mileage')}:</span>
                    <span className="font-bold text-slate-800">{formData.next_maintenance_mileage || '-'}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Truck className="w-4 h-4" /> {t('vehicle_type')}
              </label>
              <input 
                type="text" 
                disabled={!!id && !isAdmin}
                placeholder={t('vehicle_type_placeholder')}
                value={formData.vehicle_type || ''}
                onChange={e => setFormData({...formData, vehicle_type: e.target.value})}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-white border-slate-200 focus:bg-white"
                )}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4" /> {t('driver_name')}
              </label>
              <select 
                required
                disabled={!!(typeof formData.car_id === 'object' ? (formData.car_id as any)?.id : formData.car_id) || (!!id && !isAdmin && localStorage.getItem('member_id') !== (typeof formData.member_id === 'object' ? (formData.member_id as any)?.id : formData.member_id))}
                value={typeof formData.member_id === 'object' ? (formData.member_id as any)?.id : (formData.member_id || '')}
                onChange={e => {
                  const selectedId = e.target.value;
                  const member = members.find(m => String(m.id) === String(selectedId));
                  const memberPhone = member?.phone || (member as any)?.Phone || (member as any)?.phone_number || '';
                  setFormData(prev => ({
                    ...prev, 
                    member_id: selectedId,
                    phone: memberPhone
                  }));
                }}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary appearance-none transition-all",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-white border-slate-200 focus:bg-white"
                )}
              >
                <option value="">{t('select_member')}</option>
                {sortedMembers.map(member => {
                  const busy = isMemberBusy(member.id);
                  
                  // Check if this member is linked to the selected car
                  const selectedCar = cars.find(c => String(c.id) === String(typeof formData.car_id === 'object' ? (formData.car_id as any)?.id : formData.car_id));
                  const isLinked = selectedCar?.car_users?.some((cu: any) => {
                    const cuId = typeof cu.line_user_id === 'object' ? cu.line_user_id.id : cu.line_user_id;
                    return String(cuId) === String(member.id);
                  });

                  return (
                    <option key={member.id} value={member.id} className={busy ? "text-red-500" : "text-green-500"}>
                      {member.first_name} {member.last_name} {isLinked ? ` (${t('assigned_vehicles')})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Phone className="w-4 h-4" /> {t('phone')}
            </label>
            <input 
              type="tel" 
              required
              disabled={!!id && !isAdmin}
              placeholder="08X-XXX-XXXX"
              value={formData.phone || ''}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              className={clsx(
                "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-white border-slate-200 focus:bg-white"
              )}
            />
          </div>

        </div>

        {/* Photos & Notes Section */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Camera className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-bold text-slate-800">{t('photos')} {t('and')} {t('notes')}</h3>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              {renderPhotoSection(t('photo_document'), documentPhotos, existingDocumentPhotos, 'document', (e) => handlePhotoChange(e, 'document'), (i) => removePhoto(i, 'document'), (i) => removeExistingPhoto(i, 'document'), processingPhotos)}
            </div>

            {/* Expenses Section */}
            <div className="p-4 bg-slate-50 rounded-3xl space-y-4 border border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-primary" />
                  {t('expenses')}
                </h3>
                <button
                  type="button"
                  disabled={!!id && !isAdmin}
                  onClick={handleAddExpense}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  {t('add_expense')}
                </button>
              </div>
              
              <div className="space-y-3">
                {(formData.expense_items || []).map((item, index) => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 items-end animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="col-span-6 flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('expense_name')}</label>
                      {expenseCategories.length > 0 ? (
                        <div className="relative">
                          <select 
                            disabled={!!id && !isAdmin}
                            value={item.name}
                            onChange={e => handleUpdateExpense(item.id, 'name', e.target.value)}
                            className={clsx(
                              "w-full px-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all text-sm appearance-none",
                              (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500" : "bg-white border-slate-200 focus:border-primary"
                            )}
                          >
                            <option value="">{t('select_expense_category', 'เลือกรายการ')}</option>
                            {expenseCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                            <option value={t('other')}>{t('other')}</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      ) : (
                        <input 
                          type="text"
                          disabled={!!id && !isAdmin}
                          value={item.name}
                          onChange={e => handleUpdateExpense(item.id, 'name', e.target.value)}
                          className={clsx(
                            "w-full px-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all text-sm",
                            (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500" : "bg-white border-slate-200 focus:border-primary"
                          )}
                          placeholder={t('expense_name')}
                        />
                      )}
                    </div>
                    <div className="col-span-5 flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('expense_amount')}</label>
                      <div className="relative">
                        <input 
                          type="number"
                          step="0.01"
                          disabled={!!id && !isAdmin}
                          value={item.amount || ''}
                          onChange={e => handleUpdateExpense(item.id, 'amount', e.target.value)}
                          className={clsx(
                            "w-full pl-4 pr-10 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all text-sm",
                            (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500" : "bg-white border-slate-200 focus:border-primary"
                          )}
                          placeholder="0.00"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{t('baht')}</span>
                      </div>
                    </div>
                    <div className="col-span-1 flex items-center justify-center pb-1">
                      <button
                        type="button"
                        disabled={!!id && !isAdmin}
                        onClick={() => handleRemoveExpense(item.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {(formData.expense_items || []).length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl">
                    <p className="text-sm text-slate-400">{t('no_expenses')}</p>
                  </div>
                )}

                {(formData.expense_items || []).length > 0 && (
                  <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-500">{t('total_expenses')}</span>
                    <span className="text-lg font-black text-primary">
                      {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })} {t('baht')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4" /> {t('notes')}
              </label>
              <textarea 
                rows={4}
                disabled={!!id && !isAdmin}
                placeholder={t('notes_placeholder')}
                value={formData.notes || ''}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-white border-slate-200 focus:bg-white"
                )}
              />
            </div>

            {/* Signature Section */}
            <div className="space-y-4">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <PenTool className="w-4 h-4" /> {t('signature')}
              </label>
              
              {formData.signature ? (
                <div className="relative group">
                  <img 
                    src={formData.signature.startsWith('http') ? formData.signature : directusApi.getFileUrl(formData.signature)} 
                    alt="Signature" 
                    className="w-full h-40 object-contain bg-white border border-slate-200 rounded-2xl"
                    referrerPolicy="no-referrer"
                  />
                  {isAdmin && (
                    <button 
                      onClick={() => setFormData({...formData, signature: ''})}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden h-40">
                    <SignaturePad 
                      ref={signaturePadRef}
                      canvasProps={{
                        className: "w-full h-full cursor-crosshair"
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => signaturePadRef.current?.clear()}
                      className="absolute bottom-2 right-2 p-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg text-slate-500 hover:text-red-500 transition-colors"
                      title={t('clear')}
                    >
                      <Eraser className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      placeholder={t('receiver_name')}
                      value={formData.signature_name}
                      onChange={e => setFormData({...formData, signature_name: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          {!isAdmin && (formData.status === 'accepted') && (
            <button
              type="button"
              onClick={handleCompleteJob}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
            >
              {t('job_completed_msg')}
            </button>
          )}

          <button 
            type="submit"
            disabled={submitting || processingPhotos || !isEditable}
            className="w-full bg-primary text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {submitting || processingPhotos ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {processingPhotos ? t('processing_photos') : t('loading')}
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {t('save_report')}
              </>
            )}
          </button>
        </div>
      </form>

      {/* Fullscreen Image Preview */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setFullscreenImage(null)}
        >
          <button 
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            onClick={() => setFullscreenImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img 
            src={fullscreenImage} 
            alt="Fullscreen" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Webcam Modal */}
      {showWebcam && (
        <WebcamModal 
          isOpen={showWebcam}
          onCapture={handleWebcamCapture} 
          onClose={() => {
            setShowWebcam(false);
            setWebcamType(null);
          }} 
        />
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">{t('confirm_report_data')}</h3>
              <button onClick={() => setShowConfirmModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              <div className="bg-white p-4 rounded-xl space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">{t('job_type_label')}:</span>
                  <span className="text-sm font-semibold text-slate-900">{formData.job_type === 'round_trip' ? t('round_trip') : t('one_way')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">{t('date_label')}:</span>
                  <span className="text-sm font-semibold text-slate-900">{formData.work_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">{t('customer_label')}:</span>
                  <span className="text-sm font-semibold text-slate-900">{formData.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">{t('origin_label')}:</span>
                  <span className="text-sm font-semibold text-slate-900 text-right max-w-[200px] truncate">{formData.origin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">{t('destination_label')}:</span>
                  <span className="text-sm font-semibold text-slate-900 text-right max-w-[200px] truncate">{formData.destination}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">{t('estimated_distance_label')}:</span>
                  <span className="text-sm font-semibold text-slate-900">{formData.estimated_distance || 0} {t('km')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">{t('registration_plate')}:</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {cars.find(c => String(c.id) === String(typeof formData.car_id === 'object' ? (formData.car_id as any)?.id : formData.car_id))?.car_number || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">{t('driver_name')}:</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {members.find(m => String(m.id) === String(typeof formData.member_id === 'object' ? (formData.member_id as any)?.id : formData.member_id))?.display_name || '-'}
                  </span>
                </div>

                {formData.routes && formData.routes.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 mt-3 space-y-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('route_details')}</p>
                    {formData.routes.map((route, rIdx) => (
                      <div key={rIdx} className="p-3 bg-slate-50 rounded-xl space-y-2">
                        <p className="text-xs font-bold text-primary">
                          {t('route_number', { number: rIdx + 1 })}
                          {route.distance && ` (${route.distance} ${t('km')})`}
                        </p>
                        
                        {route.pickups && route.pickups.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{t('pickup_points')}</p>
                            {route.pickups.map((p, pIdx) => (
                              <div key={pIdx} className="flex flex-col text-xs">
                                <span className="font-semibold text-slate-700">📍 {p.name || '-'}</span>
                                {p.time && <span className="text-slate-400 ml-5">{t('time')}: {formatFlexDateTime(p.time)}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {route.deliveries && route.deliveries.length > 0 && (
                          <div className="space-y-1 mt-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{t('delivery_points')}</p>
                            {route.deliveries.map((d, dIdx) => (
                              <div key={dIdx} className="flex flex-col text-xs">
                                <span className="font-semibold text-slate-700">🏁 {d.name || '-'}</span>
                                {d.time && <span className="text-slate-400 ml-5">{t('time')}: {formatFlexDateTime(d.time)}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {((formData.expense_items && formData.expense_items.length > 0) || formData.toll_fee || formData.fuel_cost || formData.other_expenses) && (
                  <div className="pt-3 border-t border-slate-100 mt-3 space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('expenses')}</p>
                    {formData.expense_items && formData.expense_items.map((item, idx) => (
                      <div key={item.id} className="flex justify-between">
                        <span className="text-sm text-slate-500">{item.name || `${t('expense_name')} ${idx + 1}`}:</span>
                        <span className="text-sm font-semibold text-slate-900">{item.amount.toLocaleString()} {t('baht')}</span>
                      </div>
                    ))}
                    {formData.toll_fee && !formData.expense_items?.length && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">{t('toll_fee')}:</span>
                        <span className="text-sm font-semibold text-slate-900">{formData.toll_fee} {t('baht')}</span>
                      </div>
                    )}
                    {formData.fuel_cost && !formData.expense_items?.length && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">{t('fuel_cost')}:</span>
                        <span className="text-sm font-semibold text-slate-900">{formData.fuel_cost} {t('baht')}</span>
                      </div>
                    )}
                    {formData.other_expenses && !formData.expense_items?.length && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">{t('other_expenses')}:</span>
                        <span className="text-sm font-semibold text-slate-900">{formData.other_expenses} {t('baht')}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-slate-50 border-dashed">
                      <span className="text-sm font-bold text-slate-700">{t('total_expenses')}:</span>
                      <span className="text-sm font-black text-primary">{(totalExpenses || (Number(formData.toll_fee || 0) + Number(formData.fuel_cost || 0) + Number(formData.other_expenses || 0))).toLocaleString()} {t('baht')}</span>
                    </div>
                  </div>
                )}

                {/* Photos & Signature Preview in Confirmation */}
                {(existingPickupPhotos.length > 0 || pickupPhotos.length > 0 || 
                  existingDeliveryPhotos.length > 0 || deliveryPhotos.length > 0 || 
                  existingDocumentPhotos.length > 0 || documentPhotos.length > 0 ||
                  formData.signature) && (
                  <div className="pt-4 border-t border-slate-100 mt-4 space-y-4">
                    {/* Photos */}
                    {(existingPickupPhotos.length > 0 || pickupPhotos.length > 0 || 
                      existingDeliveryPhotos.length > 0 || deliveryPhotos.length > 0 || 
                      existingDocumentPhotos.length > 0 || documentPhotos.length > 0) && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <Camera className="w-4 h-4" /> {t('photos')}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            ...existingPickupPhotos.map(id => ({ url: directusApi.getFileUrl(id, { key: 'system-medium-contain' }), title: t('photo_pickup') })),
                            ...pickupPhotos.map(p => ({ url: p.preview, title: t('photo_pickup') })),
                            ...existingDeliveryPhotos.map(id => ({ url: directusApi.getFileUrl(id, { key: 'system-medium-contain' }), title: t('photo_delivery') })),
                            ...deliveryPhotos.map(p => ({ url: p.preview, title: t('photo_delivery') })),
                            ...existingDocumentPhotos.map(id => ({ url: directusApi.getFileUrl(id, { key: 'system-medium-contain' }), title: t('photo_document') })),
                            ...documentPhotos.map(p => ({ url: p.preview, title: t('photo_document') }))
                          ].map((item, idx) => (
                            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm group">
                              <img 
                                src={item.url} 
                                alt={item.title} 
                                className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-110"
                                onClick={() => setFullscreenImage(item.url)}
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[8px] text-white py-0.5 px-1 truncate pointer-events-none">
                                {item.title}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Signature */}
                    {formData.signature && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <PenTool className="w-4 h-4" /> {t('signature')}
                        </p>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col items-center">
                          <img src={formData.signature} alt="Signature preview" className="max-h-32 object-contain" />
                          {formData.signature_name && (
                            <p className="text-sm font-bold text-slate-700 mt-2 border-t border-slate-200 pt-2 w-full text-center">
                              {formData.signature_name}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  {t('check_info_correct')}
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-white transition-colors"
              >
                {t('edit_info')}
              </button>
              <button
                type="button"
                onClick={executeSave}
                className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
              >
                {t('confirm_save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center">
              <div className={clsx(
                "w-20 h-20 rounded-full flex items-center justify-center mb-6",
                statusConfig.type === 'success' ? "bg-emerald-50 text-emerald-500" : 
                statusConfig.type === 'warning' ? "bg-amber-50 text-amber-500" : "bg-red-50 text-red-500"
              )}>
                {statusConfig.type === 'success' ? (
                  <CheckCircle2 className="w-10 h-10" />
                ) : statusConfig.type === 'warning' ? (
                  <AlertTriangle className="w-10 h-10" />
                ) : (
                  <AlertCircle className="w-10 h-10" />
                )}
              </div>
              
              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                {statusConfig.title}
              </h3>
              
              <p className="text-slate-500 mb-8 whitespace-pre-line">
                {statusConfig.message}
              </p>
              
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  if (statusConfig.action) statusConfig.action();
                }}
                className={clsx(
                  "w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg",
                  statusConfig.type === 'success' ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100" : 
                  statusConfig.type === 'warning' ? "bg-amber-500 hover:bg-amber-600 shadow-amber-100" : "bg-red-500 hover:bg-red-600 shadow-red-100"
                )}
              >
                {statusConfig.type === 'success' ? t('save') : 
                 statusConfig.type === 'warning' ? t('ok') : t('try_again')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={showCancelConfirm}
        title={t('cancel_job')}
        message={
          <div className="space-y-4">
            <div>{t('confirm_cancel_job')}</div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {t('cancel_reason')}
              </label>
              <textarea
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                rows={3}
                placeholder={t('enter_cancel_reason')}
              />
            </div>
          </div>
        }
        onConfirm={handleCancelJob}
        onCancel={() => setShowCancelConfirm(false)}
        confirmText={t('cancel_job')}
      />

      <ConfirmModal 
        isOpen={showDeleteConfirm}
        title={t('delete')}
        message={t('confirm_delete_message')}
        onConfirm={confirmDeleteJob}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText={t('delete')}
        isDestructive={true}
      />

      <ConfirmModal
        isOpen={showCompleteConfirm}
        onCancel={() => setShowCompleteConfirm(false)}
        onConfirm={confirmCompleteJob}
        title={t('confirm_complete_job')}
        message={t('confirm_complete_job_msg')}
        isDestructive={false}
      />

      <ConfirmModal
        isOpen={showRouteCompleteConfirm}
        onCancel={() => {
          setShowRouteCompleteConfirm(false);
          setCompletingRouteIndex(null);
        }}
        onConfirm={confirmCompleteRoute}
        title={t('confirm_complete_route')}
        message={t('confirm_complete_route_msg', { number: (completingRouteIndex !== null ? completingRouteIndex + 1 : '') })}
        isDestructive={false}
      />

    </div>
  );
};
