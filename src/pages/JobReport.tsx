import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Select from 'react-select';
import { directusApi, api, DIRECTUS_URL, STATIC_API_KEY } from '../api/directus';
import { lineService } from '../services/lineService';
import { Car, Member, CustomerLocation } from '../types';
import clsx from 'clsx';
import EXIF from 'exif-js';
import { 
  Calendar, 
  Building2, 
  MapPin, 
  Truck, 
  User, 
  Phone, 
  Hash,
  Clock, 
  Gauge, 
  FileText, 
  Camera, 
  Send, 
  Loader2, 
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
  Coins
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

const StatusTimeline: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();
  const steps = [
    { key: 'pending', label: t('status_pending') },
    { key: 'accepted', label: t('status_accepted') },
    { key: 'arrived', label: 'Arrived' },
    { key: 'completed', label: t('status_completed') }
  ];

  const currentIdx = steps.findIndex(s => s.key === status);
  const isCancelled = status === 'cancelled' || status === 'cancel_pending';

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-6">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
        {steps.map((step, idx) => {
          const isActive = idx <= currentIdx && !isCancelled;
          const isCurrent = idx === currentIdx && !isCancelled;
          
          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center gap-2">
              <div className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500",
                isActive ? "bg-primary text-white scale-110 shadow-lg shadow-blue-100" : "bg-slate-100 text-slate-400",
                isCurrent && "ring-4 ring-blue-50"
              )}>
                {isActive ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
              </div>
              <span className={clsx(
                "text-[10px] font-bold uppercase tracking-wider",
                isActive ? "text-primary" : "text-slate-400"
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      {isCancelled && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {status === 'cancel_pending' ? t('status_cancel_pending') : t('status_cancelled')}
        </div>
      )}
    </div>
  );
};

export const JobReport: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const userRole = localStorage.getItem('user_role') || 'customer';
  const isAdmin = userRole.toLowerCase() === 'administrator' || userRole.toLowerCase() === 'admin';

  const [cars, setCars] = useState<Car[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [customers, setCustomers] = useState<CustomerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [originalCustomerAndCar, setOriginalCustomerAndCar] = useState<{customerId: string, carId: string} | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    work_date: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm
    customer_name: '',
    customer_contact_name: '',
    customer_contact_phone: '',
    origin: '',
    origin_lat: undefined as number | undefined,
    origin_lng: undefined as number | undefined,
    destination: '',
    destination_lat: undefined as number | undefined,
    destination_lng: undefined as number | undefined,
    vehicle_type: '',
    car_id: '',
    driver_id: '',
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
    photo_metadata: [] as any[],
    current_mileage: undefined as number | undefined,
    next_maintenance_date: undefined as string | undefined,
    next_maintenance_mileage: undefined as number | undefined
  });

  const [allReports, setAllReports] = useState<any[]>([]);

  const isDriverBusy = (driverId: string) => {
    return allReports.some(r => 
      String(r.driver_id?.id || r.driver_id) === String(driverId) && 
      !['completed', 'cancelled'].includes(r.status) &&
      String(r.id) !== String(id)
    );
  };

  const getLastMileage = (carId: string) => {
    const carReports = allReports
      .filter(r => String(r.car_id?.id || r.car_id) === String(carId) && r.status === 'completed')
      .sort((a, b) => new Date(b.arrival_time || b.date_created).getTime() - new Date(a.arrival_time || a.date_created).getTime());
    
    return carReports.length > 0 ? carReports[0].mileage_end : 0;
  };

  const resolveMemberId = (idOrUid: any) => {
    if (!idOrUid || idOrUid === 'null' || idOrUid === 'undefined' || idOrUid === '') return null;
    const idStr = String(idOrUid);
    
    // Try to find by Directus ID first
    let member = members.find(m => String(m.id) === idStr);
    if (member) return String(member.id);
    
    // If not found, try to find by LINE UID
    member = members.find(m => String(m.line_user_id) === idStr);
    if (member) return String(member.id);
    
    if (members.length > 0) {
      console.warn(`resolveMemberId: Could not find member for ${idStr} in ${members.length} loaded members`);
    }
    
    return idStr; // Fallback to original
  };

  const totalDistance = useMemo(() => {
    const start = parseFloat(formData.mileage_start);
    const end = parseFloat(formData.mileage_end);
    if (!isNaN(start) && !isNaN(end)) {
      return end - start;
    }
    return 0;
  }, [formData.mileage_start, formData.mileage_end]);

  const filteredCars = useMemo(() => {
    const memberId = localStorage.getItem('member_id');
    const userRole = localStorage.getItem('user_role');
    
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
            if (assignedCars.length > 0) return assignedCars;
          }
        }
      }
      return cars;
    }
    
    // Drivers see all cars
    if (userRole === 'driver') {
      return cars;
    }
    
    // Customers only see cars assigned to them
    if (userRole === 'customer' && memberId) {
      return cars.filter(car => 
        car.car_users?.some((cu: any) => {
          const cuId = typeof cu.line_user_id === 'object' ? cu.line_user_id.id : cu.line_user_id;
          return String(cuId) === String(memberId);
        })
      );
    }
    
    return cars;
  }, [cars, isAdmin, formData.customer_name, customers, members]);
  const [statusConfig, setStatusConfig] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
    action?: () => void;
  }>({ type: 'success', title: '', message: '' });
  const [photos, setPhotos] = useState<{file: File, metadata: any, preview: string}[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const isAdminUser = localStorage.getItem('is_admin') === 'true';
        
        let carsData = [];
        let membersData = [];
        let customersData = [];

        try {
          const [c, m, cl, ar] = await Promise.all([
            directusApi.getCars(),
            directusApi.getMembers(),
            directusApi.getCustomerLocations(),
            api.get('/items/work_reports', { params: { limit: -1 } }).then(res => res.data.data)
          ]);
          carsData = c;
          membersData = m;
          customersData = cl;
          setAllReports(ar);
        } catch (fetchErr: any) {
          console.error('Initial fetch error in JobReport:', fetchErr);
          // If members fail but user is admin, we might still want to see the form
          if (fetchErr.message?.includes('line_users')) {
            const [c, cl, ar] = await Promise.all([
              directusApi.getCars(),
              directusApi.getCustomerLocations(),
              api.get('/items/work_reports', { params: { limit: -1 } }).then(res => res.data.data)
            ]);
            carsData = c;
            customersData = cl;
            setAllReports(ar);
          } else {
            throw fetchErr;
          }
        }

        setCars(carsData);
        setMembers(membersData);
        setCustomers(customersData);
        console.log(`JobReport: Loaded ${membersData.length} members, ${customersData.length} customers, ${carsData.length} cars`);

        // Check LINE configuration
        try {
          const configRes = await axios.get('/api/line/config-check');
          console.log('LINE Configuration Check:', configRes.data);
          if (!configRes.data.configured) {
            console.warn('LINE_CHANNEL_ACCESS_TOKEN is not configured in the backend.');
          }
        } catch (configErr) {
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
            work_date: formatTimeForInput(report.work_date || report.date_created),
            customer_name: report.customer_name || report.customer_id?.company_name || '',
            customer_contact_name: report.customer_contact_name || report.customer_id?.contact_name || '',
            customer_contact_phone: report.customer_contact_phone || report.customer_id?.contact_phone || '',
            origin: report.origin || '',
            origin_lat: report.origin_lat,
            origin_lng: report.origin_lng,
            destination: report.destination || '',
            destination_lat: report.destination_lat,
            destination_lng: report.destination_lng,
            vehicle_type: report.vehicle_type || report.car_id?.vehicle_type || '',
            car_id: report.car_id?.id || report.car_id || '',
            driver_id: report.driver_id?.id || report.driver_id || '',
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
            photo_metadata: report.photo_metadata || [],
            current_mileage: report.car_id?.current_mileage,
            next_maintenance_date: report.car_id?.next_maintenance_date,
            next_maintenance_mileage: report.car_id?.next_maintenance_mileage
          };
          
          setFormData(initialData);
          setInitialValues(initialData);
          setOriginalCustomerAndCar({
            customerId: String(initialData.customer_id),
            carId: String(initialData.car_id)
          });
          
          if (report.photos && Array.isArray(report.photos)) {
            const photoIds = report.photos.map((p: any) => typeof p === 'string' ? p : p.id);
            setExistingPhotos(photoIds);
            const previews = photoIds.map((fileId: string) => {
              return directusApi.getFileUrl(fileId, { key: 'system-large-contain' });
            });
            setPhotoPreviews(previews);
          }
        } else {
          if (!isAdmin) {
            // Pre-fill driver_id for new reports if user is a driver
            const memberId = localStorage.getItem('member_id');
            const userPhone = localStorage.getItem('user_phone');
            if (memberId) {
              const member = membersData.find(m => String(m.id) === String(memberId));
              const memberPhone = member?.phone || (member as any)?.Phone || (member as any)?.phone_number || userPhone || '';
              setFormData(prev => ({
                ...prev,
                driver_id: memberId,
                phone: memberPhone || prev.phone
              }));
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isAdmin]);

  // Auto-fill phone when driver changes
  useEffect(() => {
    if (formData.driver_id && members.length > 0) {
      const member = members.find(m => String(m.id) === String(formData.driver_id));
      if (member) {
        const memberPhone = member.phone || (member as any).Phone || (member as any).phone_number || '';
        // Only auto-fill if phone is currently empty or if we just changed the driver
        // To keep it simple, we'll update it if a phone exists for the member
        if (memberPhone && (formData.phone === '' || formData.phone === '08X-XXX-XXXX')) {
          setFormData(prev => ({ ...prev, phone: memberPhone }));
        }
      }
    }
  }, [formData.driver_id, members]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSubmitting(true);
    try {
      const newPhotos = [...photos];
      const newPreviews = [...photoPreviews];

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

        newPhotos.push({
          file,
          metadata,
          preview: previewUrl
        } as any);
        newPreviews.push(previewUrl);
      }

      setPhotos(newPhotos);
      setPhotoPreviews(newPreviews);
    } catch (err) {
      console.error("Error processing photos:", err);
      setError("Error processing photos. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const removePhoto = (index: number) => {
    // If it's an existing photo (index < existingPhotos.length)
    if (index < existingPhotos.length) {
      setExistingPhotos(prev => prev.filter((_, i) => i !== index));
    } else {
      // It's a new photo
      const newPhotoIndex = index - existingPhotos.length;
      setPhotos(prev => prev.filter((_, i) => i !== newPhotoIndex));
    }
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
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

  const sendCustomerStatusNotification = async (status: 'pending' | 'accepted' | 'completed', jobId?: string, targetCustomerId?: string) => {
    try {
      const currentCustomerId = targetCustomerId || (typeof formData.customer_id === 'object' ? (formData.customer_id as any).id : formData.customer_id);
      const currentCarId = typeof formData.car_id === 'object' ? (formData.car_id as any).id : formData.car_id;
      const currentDriverId = typeof formData.driver_id === 'object' ? (formData.driver_id as any).id : formData.driver_id;
      const currentReportId = jobId || id;

      console.log(`Starting customer notification for status: ${status}, customer_id: ${currentCustomerId}, report_id: ${currentReportId}`);
      
      const notificationsEnabled = localStorage.getItem('line_notifications_enabled') !== 'false';
      console.log('LINE Notifications enabled in settings:', notificationsEnabled);
      
      if (!notificationsEnabled) {
        console.log('Customer notifications are disabled in localStorage');
        return;
      }

      if (!currentCustomerId) {
        console.log('No customer ID provided for notification');
        return;
      }

      const customerLoc = customers.find(c => String(c.id) === String(currentCustomerId));
      console.log('Found customer location:', customerLoc ? {
        id: customerLoc.id,
        company_name: customerLoc.company_name,
        member_id: customerLoc.member_id,
        members_count: customerLoc.members?.length || 0,
        members_raw: customerLoc.members
      } : 'NOT FOUND');
      
      if (!customerLoc) {
        console.log(`Customer location ${currentCustomerId} not found in customers list`);
        console.log('Available customer IDs:', customers.map(c => c.id));
        return;
      }
      
      const memberIds: string[] = [];
      const primaryIdRaw = typeof customerLoc.member_id === 'object' ? customerLoc.member_id?.id : customerLoc.member_id;
      const primaryId = resolveMemberId(primaryIdRaw);
      if (primaryId) {
        memberIds.push(String(primaryId));
        console.log('Added primary member ID:', primaryId);
      }
      
      if (customerLoc.members && Array.isArray(customerLoc.members)) {
        customerLoc.members.forEach((m: any, idx: number) => {
          console.log(`Processing customer member ${idx}:`, m);
          const mMember = typeof m.line_user_id === 'object' ? m.line_user_id : null;
          const mIdRaw = mMember ? mMember.id : m.line_user_id;
          const mid = resolveMemberId(mIdRaw);
          if (mid && !memberIds.includes(String(mid))) {
            memberIds.push(String(mid));
            console.log(`Added additional member ID from members list: ${mid}`);
          }
        });
      }

      console.log('Member IDs to notify for customer status update:', memberIds);

      if (memberIds.length === 0) {
        console.log('Customer location has no members linked');
        return;
      }

      const selectedCar = cars.find(c => String(c.id) === String(currentCarId));
      const driver = members.find(m => String(m.id) === String(currentDriverId));
      
      const statusText = status === 'pending' ? 'ได้รับงานใหม่แล้ว' : (status === 'accepted' ? 'กำลังส่งสินค้า' : 'จัดส่งสินค้าสำเร็จ');
      const headerColor = '#2c5494'; // NES Blue
      const statusColor = status === 'completed' ? '#27ae60' : '#e54d42'; // Green for success, Red for others
      const displayId = currentReportId;

      // Send notification to each member
      console.log(`Found ${memberIds.length} members to notify:`, memberIds);
      
      for (const memberId of memberIds) {
        try {
          const member = members.find(m => String(m.id) === String(memberId));
          
          if (!member) {
            console.log(`Member not found in state for ID: ${memberId}`);
            continue;
          }

          const lineIdRaw = member.line_user_id;
          let customerLineId = null;
          
          if (typeof lineIdRaw === 'object' && lineIdRaw !== null) {
            customerLineId = (lineIdRaw as any).line_user_id || (lineIdRaw as any).id;
          } else {
            customerLineId = lineIdRaw;
          }
          
          // Final fallback: if it's still an object, it might be the member object itself from a relation
          if (typeof customerLineId === 'object' && customerLineId !== null) {
            customerLineId = (customerLineId as any).line_user_id || (customerLineId as any).id;
          }

          if (!customerLineId || typeof customerLineId !== 'string' || customerLineId.length < 5) {
            console.log(`Customer LINE ID not found or invalid for member: ${memberId}. LINE ID: ${customerLineId}. Member data:`, member);
            continue;
          }

          console.log(`Preparing message for member ${memberId} with LINE ID ${customerLineId}`);
          
          if (!customerLineId) {
            console.log(`Member ${memberId} has no LINE ID, skipping notification`);
            continue;
          }

          const flexContents: any = {
            type: "bubble",
            header: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "Nationwide Express Tracker",
                  color: "#ffffff",
                  weight: "bold",
                  size: "sm"
                }
              ],
              backgroundColor: headerColor,
              paddingAll: "md"
            },
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "แจ้งเตือนการส่งสินค้า",
                  weight: "bold",
                  size: "xl",
                  color: statusColor,
                  margin: "md",
                  align: "center"
                },
                {
                  type: "box",
                  layout: "vertical",
                  margin: "lg",
                  contents: [
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: "ต้นทาง",
                          size: "xxs",
                          color: status === 'pending' || status === 'accepted' || status === 'completed' ? "#2c5494" : "#aaaaaa",
                          weight: status === 'pending' || status === 'accepted' || status === 'completed' ? "bold" : "regular"
                        },
                        {
                          type: "text",
                          text: "กำลังส่งสินค้า",
                          size: "xxs",
                          color: status === 'accepted' || status === 'completed' ? "#2c5494" : "#aaaaaa",
                          align: "center",
                          weight: status === 'accepted' || status === 'completed' ? "bold" : "regular"
                        },
                        {
                          type: "text",
                          text: "ปลายทาง",
                          size: "xxs",
                          color: status === 'completed' ? "#2c5494" : "#aaaaaa",
                          align: "end",
                          weight: status === 'completed' ? "bold" : "regular"
                        }
                      ]
                    },
                    {
                      type: "box",
                      layout: "vertical",
                      contents: [
                        {
                          type: "box",
                          layout: "horizontal",
                          contents: [
                            {
                              type: "box",
                              layout: "vertical",
                              contents: [],
                              height: "6px",
                              backgroundColor: status === 'completed' ? "#2c5494" : (status === 'accepted' ? "#2c5494" : "#eeeeee"),
                              flex: 1
                            },
                            {
                              type: "box",
                              layout: "vertical",
                              contents: [],
                              height: "6px",
                              backgroundColor: status === 'completed' ? "#2c5494" : "#eeeeee",
                              flex: 1
                            }
                          ],
                          cornerRadius: "lg"
                        },
                        {
                          type: "box",
                          layout: "vertical",
                          contents: [],
                          width: "14px",
                          height: "14px",
                          cornerRadius: "7px",
                          borderWidth: "2px",
                          borderColor: "#2c5494",
                          backgroundColor: "#ffffff",
                          position: "absolute",
                          offsetTop: "-4px",
                          offsetStart: status === 'pending' ? "0%" : (status === 'accepted' ? "48%" : "95%")
                        }
                      ],
                      margin: "sm"
                    }
                  ]
                },
                {
                  type: "box",
                  layout: "vertical",
                  margin: "xl",
                  spacing: "sm",
                  contents: [
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: "🆔 เลขที่เคส",
                          size: "sm",
                          color: "#2c5494",
                          flex: 2
                        },
                        {
                          type: "text",
                          text: String(displayId || 'N/A'),
                          size: "sm",
                          color: "#111111",
                          flex: 5
                        }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: "🏢 บริษัท",
                          size: "sm",
                          color: "#2c5494",
                          flex: 2
                        },
                        {
                          type: "text",
                          text: String(formData.customer_name || '-'),
                          size: "sm",
                          color: "#111111",
                          flex: 5,
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
                          text: "📦 สถานะ",
                          size: "sm",
                          color: "#2c5494",
                          flex: 2
                        },
                        {
                          type: "text",
                          text: statusText,
                          size: "sm",
                          color: "#111111",
                          flex: 5,
                          weight: "bold"
                        }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: "📍 ต้นทาง",
                          size: "sm",
                          color: "#2c5494",
                          flex: 2
                        },
                        {
                          type: "text",
                          text: String(formData.origin || '-'),
                          size: "sm",
                          color: "#111111",
                          flex: 5,
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
                          text: "🏁 ปลายทาง",
                          size: "sm",
                          color: "#2c5494",
                          flex: 2
                        },
                        {
                          type: "text",
                          text: String(formData.destination || '-'),
                          size: "sm",
                          color: "#111111",
                          flex: 5,
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
                          text: "🚚 รถ",
                          size: "sm",
                          color: "#2c5494",
                          flex: 2
                        },
                        {
                          type: "text",
                          text: String(selectedCar?.car_number || 'N/A'),
                          size: "sm",
                          color: "#111111",
                          flex: 5
                        }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: "👤 คนขับ",
                          size: "sm",
                          color: "#2c5494",
                          flex: 2
                        },
                        {
                          type: "text",
                          text: String(driver ? `${driver.first_name} ${driver.last_name}` : '-'),
                          size: "sm",
                          color: "#111111",
                          flex: 5
                        }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: "📞 เบอร์คนขับ",
                          size: "sm",
                          color: "#2c5494",
                          flex: 2
                        },
                        {
                          type: "text",
                          text: String(driver?.phone || '-'),
                          size: "sm",
                          color: "#111111",
                          flex: 5
                        }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: "📅 วันที่",
                          size: "sm",
                          color: "#2c5494",
                          flex: 2
                        },
                        {
                          type: "text",
                          text: String(formData.work_date || '-'),
                          size: "sm",
                          color: "#111111",
                          flex: 5
                        }
                      ]
                    }
                  ]
                }
              ],
              paddingAll: "lg"
            },
            footer: {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              contents: [
                {
                  type: "button",
                  style: "primary",
                  height: "sm",
                  color: "#e54d42",
                  action: {
                    type: "uri",
                    label: "เข้าสู่ระบบ",
                    uri: "https://app.nesxp.com/"
                  }
                }
              ],
              flex: 0
            }
          };

          await sendLineNotification(customerLineId, [{ type: "flex", altText: `แจ้งเตือนการส่งสินค้า: ${statusText}`, contents: flexContents }], `แจ้งเตือนการส่งสินค้า: ${statusText}`);
        } catch (memberErr) {
          console.error(`Failed to send LINE notification to member ${memberId}:`, memberErr);
        }
      }
    } catch (error) {
      console.error('Error in sendCustomerStatusNotification:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleSubmit triggered', formData);
    
    // Basic validation for new reports
    if (!id) {
      if (!formData.car_id || !formData.driver_id || !formData.customer_name || !formData.origin || !formData.destination) {
        setStatusConfig({
          type: 'error',
          title: t('incomplete_info'),
          message: t('please_fill_required')
        });
        setShowStatusModal(true);
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      // Extract IDs properly
      const currentCustomerId = typeof formData.customer_id === 'object' ? (formData.customer_id as any).id : formData.customer_id;
      const currentCarId = typeof formData.car_id === 'object' ? (formData.car_id as any).id : formData.car_id;
      const currentDriverId = typeof formData.driver_id === 'object' ? (formData.driver_id as any).id : formData.driver_id;

      const getSafeId = (val: any) => {
        if (!val) return '';
        if (typeof val === 'object') return String(val.id || '');
        return String(val);
      };

      console.log('handleSubmit: Extracted IDs:', { currentCustomerId, currentCarId, currentDriverId });
      
      if (!currentCustomerId) {
        console.warn('handleSubmit: currentCustomerId is empty! Customer notifications might fail.');
      }

      // 1. Upload new photos to Directus if any
      const uploadedPhotoIds: string[] = [];
      const newPhotoMetadata: any[] = [];
      
      if (photos.length > 0) {
        for (const photoObj of photos) {
          try {
            const fileId = await directusApi.uploadFile(photoObj.file);
            uploadedPhotoIds.push(fileId);
            
            if (photoObj.metadata) {
              newPhotoMetadata.push({
                file_id: fileId,
                latitude: photoObj.metadata.latitude,
                longitude: photoObj.metadata.longitude,
                timestamp: photoObj.metadata.timestamp
              });
            }
          } catch (uploadErr: any) {
            console.error('Error uploading file:', uploadErr.response?.data || uploadErr.message);
            const detail = uploadErr.response?.data?.errors?.[0]?.message || uploadErr.message;
            throw new Error(`Failed to upload photo: ${detail}`);
          }
        }
      }

      // 1.6 Mandatory photos check for drivers
      if (!isAdmin && id) {
        const totalPhotos = (existingPhotos.length + uploadedPhotoIds.length);
        if (totalPhotos < 2) {
          setError(t('mandatory_photos_error'));
          setSubmitting(false);
          return;
        }
      }

      // 1.7 Mileage validation check
      if (formData.car_id && formData.mileage_start && parseFloat(formData.mileage_start) < getLastMileage(formData.car_id)) {
        setError(t('mileage_less_than_previous', { mileage: getLastMileage(formData.car_id) }));
        setSubmitting(false);
        return;
      }

      // 1.8 Time validation: Arrival cannot be before Departure
      if (formData.departure_time && formData.arrival_time) {
        const departure = new Date(formData.departure_time).getTime();
        const arrival = new Date(formData.arrival_time).getTime();
        if (arrival < departure) {
          setError(t('arrival_before_departure_error') || 'เวลาถึงต้องไม่น้อยกว่าเวลาออกเดินทาง');
          setSubmitting(false);
          return;
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
      const standby = formatTime(formData.standby_time);
      if (standby) reportData.standby_time = standby;

      const departure = formatTime(formData.departure_time);
      if (departure) reportData.departure_time = departure;

      const arrival = formatTime(formData.arrival_time);
      if (arrival) reportData.arrival_time = arrival;

      if (formData.mileage_start !== '') {
        const val = parseInt(formData.mileage_start.toString());
        if (!isNaN(val)) reportData.mileage_start = val;
      }
      
      if (formData.mileage_end !== '') {
        const val = parseInt(formData.mileage_end.toString());
        if (!isNaN(val)) {
          reportData.mileage_end = val;
          // If driver finishes the job, mark as completed
          if (formData.status === 'accepted') {
            reportData.status = 'completed';
          }
        }
      }

      if (formData.notes) {
        reportData.notes = formData.notes;
      }

      if (!id || isAdmin) {
        // New report OR Admin can edit everything
        // For new reports, we include the basic info
        if (formData.work_date) {
          const wd = formatTime(formData.work_date);
          if (wd) reportData.work_date = wd;
        }
        if (formData.customer_name) reportData.customer_name = formData.customer_name;
        if (formData.customer_id && formData.customer_id !== '') reportData.customer_id = formData.customer_id;
        if (formData.customer_contact_name) reportData.customer_contact_name = formData.customer_contact_name;
        if (formData.customer_contact_phone) reportData.customer_contact_phone = formData.customer_contact_phone;
        if (formData.origin) reportData.origin = formData.origin;
        if (formData.destination) reportData.destination = formData.destination;
        if (formData.phone) reportData.phone = formData.phone;
        if (formData.car_id && formData.car_id !== '') reportData.car_id = formData.car_id;
        if (formData.driver_id && formData.driver_id !== '') reportData.driver_id = formData.driver_id;
        if (formData.vehicle_type) reportData.vehicle_type = formData.vehicle_type;
        reportData.status = formData.status;
      }

      if (uploadedPhotoIds.length > 0 || existingPhotos.length > 0) {
        reportData.photos = [...existingPhotos, ...uploadedPhotoIds];
        reportData.photo_metadata = [...(formData.photo_metadata || []), ...newPhotoMetadata];
      }
      
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
          await assignCarToCustomer(currentCustomerId, currentCarId, currentDriverId);
        }

        // Send notifications if status changed to completed
        if (reportData.status === 'completed') {
          console.log('Status changed to completed, triggering notifications and unassignment...');
          try {
            await sendCustomerStatusNotification('completed');
            await sendDriverStatusNotification('completed');
            await unassignCarFromCustomer(currentCustomerId, currentCarId);
            console.log('Completion actions triggered successfully');
          } catch (notifyErr) {
            console.error('Error sending completion notifications/unassignment:', notifyErr);
          }
        }
        
        setStatusConfig({
          type: 'success',
          title: t('save_success'),
          message: t('report_saved_success'),
          action: () => {
            if (isAdmin) {
              navigate('/jobs/history');
            } else {
              navigate('/jobs/my');
            }
          }
        });
        setShowStatusModal(true);
      } else {
        console.log('Creating new report...');
        const result = await directusApi.createWorkReport(reportData);
        console.log('Creation successful:', result);
        
        // 1. Assign car to customer's members AND the driver
        if (currentCustomerId && currentCarId) {
          console.log('Assigning car to customer and driver:', { currentCustomerId, currentCarId, currentDriverId });
          await assignCarToCustomer(currentCustomerId, currentCarId, currentDriverId);
        }
        
        // 2. Send LINE notification to driver for NEW job
        try {
          const notificationsEnabled = localStorage.getItem('line_notifications_enabled') !== 'false';
          const driver = members.find(m => String(m.id) === String(currentDriverId));
          const lineIdRaw = driver?.line_user_id;
          let lineId = null;
          if (typeof lineIdRaw === 'object' && lineIdRaw !== null) {
            lineId = (lineIdRaw as any).line_user_id || (lineIdRaw as any).id;
          } else {
            lineId = lineIdRaw;
          }
          console.log(`Driver LINE ID extraction:`, { raw: lineIdRaw, extracted: lineId });

          if (notificationsEnabled && lineId) {
            const selectedCar = cars.find(c => String(c.id) === String(currentCarId));
            const accountSource = driver?.line_user_id ? '(สมัครผ่าน LINE)' : '(Admin สร้าง)';
            const driverName = driver ? `${driver.first_name} ${driver.last_name} ${accountSource}` : 'N/A';
            
            const messages = [
              {
                type: "text",
                text: `🔔 มีงานใหม่มอบหมายให้คุณ\n\n🆔 เคส: ${result.id || 'N/A'}\n🏢 ลูกค้า: ${formData.customer_name}\n👤 ผู้ติดต่อ: ${formData.customer_contact_name || '-'}\n📞 เบอร์ติดต่อ: ${formData.customer_contact_phone || '-'}\n📍 ต้นทาง: ${formData.origin}\n🏁 ปลายทาง: ${formData.destination}\n🚚 รถ: ${selectedCar?.car_number || ''}\n📅 วันที่: ${formData.work_date}`
              },
              {
                type: "flex",
                altText: "รายละเอียดงานใหม่",
                contents: {
                  type: "bubble",
                  header: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      {
                        type: "text",
                        text: "Nationwide Express Tracker",
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
                        text: "มีงานใหม่มอบหมายให้คุณ",
                        weight: "bold",
                        size: "xl",
                        margin: "md",
                        color: "#2c5494",
                        wrap: true
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
                                text: "🆔 เลขที่เคส",
                                size: "sm",
                                color: "#8c8c8c",
                                flex: 1
                              },
                              {
                                type: "text",
                                text: String(result.id || 'N/A'),
                                size: "sm",
                                color: "#111111",
                                flex: 3
                              }
                            ]
                          },
                          {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                              {
                                type: "text",
                                text: "ทะเบียนรถ",
                                size: "sm",
                                color: "#8c8c8c",
                                flex: 1
                              },
                              {
                                type: "text",
                                text: selectedCar?.car_number || 'N/A',
                                size: "sm",
                                color: "#111111",
                                flex: 3
                              }
                            ]
                          },
                          {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                              {
                                type: "text",
                                text: "ลูกค้า",
                                size: "sm",
                                color: "#8c8c8c",
                                flex: 1
                              },
                              {
                                type: "text",
                                text: formData.customer_name,
                                size: "sm",
                                color: "#111111",
                                flex: 3,
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
                                text: "ผู้ติดต่อ",
                                size: "sm",
                                color: "#8c8c8c",
                                flex: 1
                              },
                              {
                                type: "text",
                                text: formData.customer_contact_name || '-',
                                size: "sm",
                                color: "#111111",
                                flex: 3,
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
                                text: "เบอร์ติดต่อ",
                                size: "sm",
                                color: "#8c8c8c",
                                flex: 1
                              },
                              {
                                type: "text",
                                text: formData.customer_contact_phone || '-',
                                size: "sm",
                                color: "#111111",
                                flex: 3,
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
                                text: "ต้นทาง",
                                size: "sm",
                                color: "#8c8c8c",
                                flex: 1
                              },
                              {
                                type: "text",
                                text: formData.origin,
                                size: "sm",
                                color: "#111111",
                                flex: 3,
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
                                text: "ปลายทาง",
                                size: "sm",
                                color: "#8c8c8c",
                                flex: 1
                              },
                              {
                                type: "text",
                                text: formData.destination,
                                size: "sm",
                                color: "#111111",
                                flex: 3,
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
                                text: "วันที่",
                                size: "sm",
                                color: "#8c8c8c",
                                flex: 1
                              },
                              {
                                type: "text",
                                text: formData.work_date,
                                size: "sm",
                                color: "#111111",
                                flex: 3
                              }
                            ]
                          },
                          {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                              {
                                type: "text",
                                text: "คนขับ",
                                size: "sm",
                                color: "#8c8c8c",
                                flex: 1
                              },
                              {
                                type: "text",
                                text: driverName,
                                size: "sm",
                                color: "#111111",
                                flex: 3
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
                      {
                        type: "button",
                        style: "primary",
                        height: "sm",
                        color: "#e54d42",
                        action: {
                          type: "uri",
                          label: "เข้าสู่ระบบ",
                          uri: "https://app.nesxp.com/"
                        }
                      }
                    ],
                    flex: 0
                  }
                }
              }
            ];
            
            await axios.post('/api/line/send', {
              to: lineId,
              messages: messages
            });
            console.log('LINE notifications sent successfully');
          } else if (!notificationsEnabled) {
            console.log('Notifications are disabled in settings');
          } else if (!lineId) {
            console.log('Driver does not have a LINE ID linked');
          }
        } catch (lineErr: any) {
          console.error('Failed to send LINE notification:', lineErr);
          const details = lineErr.response?.data?.details;
          const errorDetails = typeof details === 'object' ? JSON.stringify(details) : (details || lineErr.message);
          
          // Show error but don't return early, so customer notification can still be attempted
          setStatusConfig({
            type: 'error',
            title: 'การแจ้งเตือน LINE ล้มเหลว',
            message: `บันทึกงานแล้ว แต่ไม่สามารถส่งการแจ้งเตือน LINE ได้: ${errorDetails}`,
            action: () => setShowStatusModal(false)
          });
          setShowStatusModal(true);
        }

        // Send LINE notification to customer and auto-link car
        try {
          await sendCustomerStatusNotification('pending', result.id, currentCustomerId);
        } catch (custErr) {
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
            setSubmitted(true);
          }
        });
        setShowStatusModal(true);
      }
    } catch (error: any) {
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

  const handleReportProblem = async (type: 'delay' | 'accident') => {
    try {
      setSubmitting(true);
      const driver = members.find(m => String(m.id) === String(formData.driver_id));
      const driverName = driver ? `${driver.first_name} ${driver.last_name}` : 'Unknown Driver';
      const selectedCar = cars.find(c => String(c.id) === String(formData.car_id));
      
      const message = `⚠️ รายงานปัญหาจากคนขับ\n\n👤 คนขับ: ${driverName}\n🚚 รถ: ${selectedCar?.car_number || 'N/A'}\n🆔 เคส: ${id || 'N/A'}\n🚩 ปัญหา: ${type === 'delay' ? 'ล่าช้า (Delay)' : 'อุบัติเหตุ (Accident)'}\n📍 ต้นทาง: ${formData.origin}\n🏁 ปลายทาง: ${formData.destination}`;
      
      const adminGroupId = import.meta.env.VITE_LINE_ADMIN_GROUP_ID || 'ADMIN_GROUP_ID_HERE';
      
      // Send to Admin Group (via lineService if configured, or just log for now)
      // In a real app, you'd have an admin group chat ID
      await lineService.sendPushMessage(adminGroupId, [{
        type: "text",
        text: message
      }]);

      setStatusConfig({
        type: 'success',
        title: t('problem_report'),
        message: t('save_success'),
        action: () => setShowStatusModal(false)
      });
      setShowStatusModal(true);
    } catch (err) {
      console.error('Error reporting problem:', err);
      setError('Failed to send report');
    } finally {
      setSubmitting(false);
    }
  };

  const sendDriverStatusNotification = async (status: 'completed') => {
    try {
      console.log(`Starting driver notification for status: ${status}, driver_id: ${formData.driver_id}`);
      const driver = members.find(m => String(m.id) === String(formData.driver_id));
      const driverLineIdRaw = driver?.line_user_id;
      let driverLineId = null;
      if (typeof driverLineIdRaw === 'object' && driverLineIdRaw !== null) {
        driverLineId = (driverLineIdRaw as any).line_user_id || (driverLineIdRaw as any).id;
      } else {
        driverLineId = driverLineIdRaw;
      }
      
      console.log(`Driver LINE ID extraction:`, { raw: driverLineIdRaw, extracted: driverLineId });
      
      if (!driverLineId) {
        console.log('Driver LINE ID not found, skipping notification. Driver ID:', formData.driver_id);
        console.log('Driver details:', driver);
        return;
      }

      const selectedCar = cars.find(c => String(c.id) === String(formData.car_id));
      const statusText = 'จัดส่งงานสำเร็จแล้ว';
      const headerColor = '#2c5494'; // NES Blue
      const statusColor = '#e54d42'; // NES Red

      const driverMessages = [
        {
          type: "flex",
          altText: `🔔 Nationwide Express Tracker: ${statusText}`,
          contents: {
            type: "bubble",
            header: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "Nationwide Express Tracker",
                  color: "#ffffff",
                  weight: "bold",
                  size: "sm"
                }
              ],
              backgroundColor: headerColor,
              paddingAll: "md"
            },
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: statusText,
                  weight: "bold",
                  size: "xl",
                  color: statusColor,
                  margin: "md"
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
                          text: "🆔 เลขที่เคส",
                          size: "sm",
                          color: "#2c5494",
                          flex: 2
                        },
                        {
                          type: "text",
                          text: String(id || 'N/A'),
                          size: "sm",
                          color: "#111111",
                          flex: 5
                        }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: "🚚 รถ",
                          size: "sm",
                          color: "#2c5494",
                          flex: 2
                        },
                        {
                          type: "text",
                          text: String(selectedCar?.car_number || 'N/A'),
                          size: "sm",
                          color: "#111111",
                          flex: 5
                        }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: "🏁 ปลายทาง",
                          size: "sm",
                          color: "#2c5494",
                          flex: 2
                        },
                        {
                          type: "text",
                          text: String(formData.destination || '-'),
                          size: "sm",
                          color: "#111111",
                          flex: 5,
                          wrap: true
                        }
                      ]
                    }
                  ]
                }
              ],
              paddingAll: "lg"
            }
          }
        }
      ];

      await sendLineNotification(driverLineId, driverMessages, `🔔 Nationwide Express Tracker: ${statusText}`);
      console.log(`Driver completion notification sent to ${driverLineId}`);
    } catch (err: any) {
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
        } catch (err) {
          console.error('assignCarToCustomer: Failed to fetch fresh customer location:', err);
        }
        return;
      }

      await processAssignment(customerLoc, carId, driverId);
    } catch (error) {
      console.error('Error in assignCarToCustomer:', error);
    }
  };

  const processAssignment = async (customerLoc: any, carId: string, driverId?: string) => {
    console.log('processAssignment: Processing for:', customerLoc.company_name);

    const memberIds: string[] = [];
    
    // 1. Resolve primary member
    const primaryMember = typeof customerLoc.member_id === 'object' ? customerLoc.member_id : null;
    const primaryIdRaw = primaryMember ? primaryMember.id : customerLoc.member_id;
    const primaryId = resolveMemberId(primaryIdRaw);
    
    if (primaryId) {
      console.log('processAssignment: Adding primary member ID:', primaryId, primaryIdRaw !== primaryId ? `(resolved from ${primaryIdRaw})` : '');
      memberIds.push(primaryId);
    } else {
      console.warn('processAssignment: Could not resolve primary member ID:', primaryIdRaw);
    }
    
    // 2. Resolve additional members
    if (customerLoc.members && Array.isArray(customerLoc.members)) {
      console.log(`processAssignment: Processing ${customerLoc.members.length} additional members`);
      customerLoc.members.forEach((m: any, idx: number) => {
        console.log(`processAssignment: Member ${idx} raw data:`, m);
        const mMember = typeof m.line_user_id === 'object' ? m.line_user_id : null;
        const mIdRaw = mMember ? mMember.id : m.line_user_id;
        const mid = resolveMemberId(mIdRaw);
        
        if (mid && !memberIds.includes(mid)) {
          console.log('processAssignment: Adding additional member ID:', mid, mIdRaw !== mid ? `(resolved from ${mIdRaw})` : '');
          memberIds.push(mid);
        } else if (!mid) {
          console.warn('processAssignment: Could not resolve additional member ID:', mIdRaw);
        }
      });
    }

    // 3. Resolve driver
    if (driverId) {
      const resolvedDriverId = resolveMemberId(driverId);
      if (resolvedDriverId && !memberIds.includes(resolvedDriverId)) {
        console.log('processAssignment: Adding driver ID:', resolvedDriverId, driverId !== resolvedDriverId ? `(resolved from ${driverId})` : '');
        memberIds.push(resolvedDriverId);
      } else if (!resolvedDriverId) {
        console.warn('processAssignment: Could not resolve driver member ID:', driverId);
      }
    }

    if (memberIds.length === 0) {
      console.warn('processAssignment: No valid member IDs found to link car to');
      return;
    }

    console.log('processAssignment: Final list of member IDs to link:', memberIds);

    if (!directusApi.linkCarToMember) {
      console.error('processAssignment: directusApi.linkCarToMember is NOT defined!');
      return;
    }

    for (const mid of memberIds) {
      try {
        console.log(`processAssignment: Linking car ${carId} to member ${mid}`);
        await directusApi.linkCarToMember(carId, mid);
      } catch (linkErr) {
        console.error(`processAssignment: Failed to link car ${carId} to member ${mid}:`, linkErr);
      }
    }
    console.log('processAssignment: Car linked successfully');
  };

  const unassignCarFromCustomer = async (targetCustomerId?: string, targetCarId?: string) => {
    try {
      const customerId = targetCustomerId || (typeof formData.customer_id === 'object' ? (formData.customer_id as any).id : formData.customer_id);
      const carId = targetCarId || (typeof formData.car_id === 'object' ? (formData.car_id as any).id : formData.car_id);
      
      if (!customerId || !carId) return;

      console.log(`Attempting to unassign car ${carId} from customer ${customerId}...`);
      
      const customerLocation = await directusApi.getCustomerLocation(customerId);
      
      const memberIds: string[] = [];
      const primaryMember = typeof customerLocation.member_id === 'object' ? customerLocation.member_id : null;
      const primaryIdRaw = primaryMember ? primaryMember.id : customerLocation.member_id;
      const primaryId = resolveMemberId(String(primaryIdRaw));
      
      if (primaryId) memberIds.push(primaryId);
      
      if (customerLocation.members && Array.isArray(customerLocation.members)) {
        customerLocation.members.forEach((m: any) => {
          const mMember = typeof m.line_user_id === 'object' ? m.line_user_id : null;
          const mIdRaw = mMember ? mMember.id : m.line_user_id;
          const mid = resolveMemberId(String(mIdRaw));
          
          if (mid && !memberIds.includes(mid)) {
            memberIds.push(mid);
          }
        });
      }

      // Add driver to unassign list
      const driverIdRaw = typeof formData.driver_id === 'object' ? (formData.driver_id as any).id : formData.driver_id;
      const driverId = resolveMemberId(String(driverIdRaw));
      if (driverId && !memberIds.includes(driverId)) {
        memberIds.push(driverId);
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
    } catch (error) {
      console.error('Error in unassignCarFromCustomer:', error);
    }
  };

  const handleAcceptJob = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await directusApi.updateWorkReport(id, { status: 'accepted' });
      setFormData(prev => ({ ...prev, status: 'accepted' }));
      
      // Notify customer
      await sendCustomerStatusNotification('accepted');

      setStatusConfig({
        type: 'success',
        title: t('job_accepted'),
        message: isAdmin ? t('status_accepted') : t('job_accepted')
      });
      setShowStatusModal(true);
    } catch (error: any) {
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

  const handleCompleteJob = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await directusApi.updateWorkReport(id, { status: 'completed' });
      setFormData(prev => ({ ...prev, status: 'completed' }));
      
      // Notify customer
      await sendCustomerStatusNotification('completed');
      
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
      
      await directusApi.deleteWorkReport(id);
      navigate('/jobs/history');
    } catch (error: any) {
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
    
    // If job is already accepted, it needs admin approval
    if (formData.status === 'accepted' && !isAdmin) {
      if (!cancelReasonInput.trim()) {
        setStatusConfig({
          type: 'error',
          title: 'เกิดข้อผิดพลาด',
          message: t('enter_cancel_reason')
        });
        setShowStatusModal(true);
        return;
      }

      setSubmitting(true);
      try {
        await directusApi.updateWorkReport(id, { 
          status: 'cancel_pending',
          cancel_reason: cancelReasonInput
        });
        setFormData(prev => ({ ...prev, status: 'cancel_pending', cancel_reason: cancelReasonInput }));
        setStatusConfig({
          type: 'success',
          title: t('request_cancel'),
          message: t('cancel_request_sent')
        });
        setShowStatusModal(true);
      } catch (error: any) {
        console.error('Error requesting cancellation:', error);
        setStatusConfig({
          type: 'error',
          title: 'เกิดข้อผิดพลาด',
          message: error.message || 'ไม่สามารถส่งคำขอได้'
        });
        setShowStatusModal(true);
      } finally {
        setSubmitting(false);
        setShowCancelConfirm(false);
      }
      return;
    }

    // Direct cancellation for pending jobs or by admin
    setSubmitting(true);
    try {
      await unassignCarFromCustomer();
      await directusApi.updateWorkReport(id, { status: 'cancelled' });
      setFormData(prev => ({ ...prev, status: 'cancelled' }));
      setStatusConfig({
        type: 'success',
        title: t('job_cancelled'),
        message: isAdmin ? t('job_cancelled_success') : t('job_cancelled')
      });
      setShowStatusModal(true);
    } catch (error: any) {
      console.error('Error cancelling job:', error);
      setStatusConfig({
        type: 'error',
        title: t('error'),
        message: error.message || t('error_cancelling_job')
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

  const generateReportText = () => {
    const selectedCar = cars.find(c => String(c.id) === String(formData.car_id));
    const selectedMember = members.find(m => String(m.id) === String(formData.driver_id));
    const accountSource = selectedMember?.line_user_id ? '(สมัครผ่าน LINE)' : '(Admin สร้าง)';
    const memberRoleLabel = selectedMember?.role === 'customer' ? t('customer_role') : t('driver_role');
    
    const formatDisplayDT = (dt: string) => dt ? dt.replace('T', ' ') : '-';
    
    return `📅 ${t('report_date')} : ${formData.work_date}
📁 ${t('customer_name')} : ${formData.customer_name}
👤 ${t('contact_name')} : ${formData.customer_contact_name || '-'}
📞 ${t('contact_phone')} : ${formData.customer_contact_phone || '-'}

📍 ${t('origin')} : ${formData.origin}
📍 ${t('destination')} : ${formData.destination}

🚚 ${t('car_number')} : ${selectedCar?.car_number || formData.car_id}

👷 ${memberRoleLabel} : ${selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name} ${accountSource}` : formData.driver_id}
📞 ${t('phone')} : ${formData.phone}

👉 ${t('standby_time')} : ${formatDisplayDT(formData.standby_time)}
👉 ${t('departure_time')} : ${formatDisplayDT(formData.departure_time)}
👉 ${t('arrival_time')} : ${formatDisplayDT(formData.arrival_time)}

🍄 ${t('mileage_start')} : ${formData.mileage_start}
🍄 ${t('mileage_end')} : ${formData.mileage_end}

📌 ${t('notes')} : ${formData.notes || '-'}`;
  };

  const isCustomer = userRole.toLowerCase() === 'customer';
  const isEditable = (!id || isAdmin || formData.status === 'accepted') && !isCustomer;
  const isPendingCancel = formData.status === 'cancel_pending';
  const selectedMember = members.find(m => String(m.id) === String(formData.driver_id));
  const selectedCar = cars.find(c => String(c.id) === String(formData.car_id));

  const InfoRow: React.FC<{ icon: React.ReactNode, label: string, value: string | React.ReactNode, className?: string }> = ({ icon, label, value, className }) => (
    <div className={clsx("flex flex-col gap-1", className)}>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
        {icon} {label}
      </label>
      <div className="text-sm font-bold text-slate-700 bg-slate-50/50 px-4 py-3 rounded-2xl border border-slate-100">
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-3xl shadow-xl space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">{t('report_submitted')}</h2>
            <p className="text-slate-500">{t('report_saved')}</p>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t('report_preview')}</p>
          <pre className="text-sm font-sans whitespace-pre-wrap text-slate-700 leading-relaxed">
            {generateReportText()}
          </pre>
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
              setPhotos([]);
              setPhotoPreviews([]);
            }}
            className="w-full bg-primary text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-100"
          >
            {t('create_new_report')}
          </button>
        </div>
      </div>
    );
  }

  if (isCustomer && id) {
    return (
      <div className="max-w-2xl mx-auto pb-12 space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t('job_details')}</h2>
            <p className="text-slate-500">{t('tracking_your_delivery') || 'ติดตามสถานะการขนส่งของคุณ'}</p>
          </div>
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Status Timeline */}
        <StatusTimeline status={formData.status} />

        {/* Driver & Vehicle Card */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
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
        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoRow icon={<Calendar className="w-3 h-3" />} label={t('report_date')} value={formData.work_date.replace('T', ' ')} />
            <InfoRow icon={<Building2 className="w-3 h-3" />} label={t('customer_name')} value={formData.customer_name} />
            <InfoRow icon={<MapPin className="w-3 h-3 text-emerald-500" />} label={t('origin')} value={formData.origin} />
            <InfoRow icon={<MapPin className="w-3 h-3 text-red-500" />} label={t('destination')} value={formData.destination} />
          </div>

          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-50">
            <div className="text-center space-y-1">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t('standby_time')}</p>
              <p className="text-xs font-bold text-slate-700">{formData.standby_time ? new Date(formData.standby_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t('departure_time')}</p>
              <p className="text-xs font-bold text-slate-700">{formData.departure_time ? new Date(formData.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t('arrival_time')}</p>
              <p className="text-xs font-bold text-slate-700">{formData.arrival_time ? new Date(formData.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
            </div>
          </div>

          {formData.notes && (
            <div className="pt-6 border-t border-slate-50">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t('notes')}</p>
              <p className="text-sm text-slate-600 italic leading-relaxed bg-slate-50 p-4 rounded-2xl">
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
              <span className="text-xs font-bold text-slate-400">{photoPreviews.length} {t('images') || 'รูปภาพ'}</span>
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
    <div className="max-w-2xl mx-auto pb-12">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{id ? t('update_job_details') : t('new_job_assignment_title')}</h2>
          <p className="text-slate-500">{id ? t('update_job_desc') : t('assign_new_job_desc')}</p>
        </div>
        {id && (
          <div className="flex flex-wrap items-center gap-3">
            {formData.status === 'pending' && (
              <button 
                type="button"
                onClick={handleAcceptJob}
                disabled={submitting}
                className="px-10 py-5 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all flex items-center gap-3 shadow-2xl shadow-emerald-200 text-xl transform hover:scale-105 active:scale-95"
              >
                <CheckCircle2 className="w-8 h-8" />
                {t('accept_job') || 'รับงาน'}
              </button>
            )}

            {isAdmin && formData.status === 'accepted' && (
              <button 
                type="button"
                onClick={handleCompleteJob}
                disabled={submitting}
                className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-all flex items-center gap-2 shadow-lg shadow-blue-100"
              >
                <CheckCircle2 className="w-5 h-5" />
                {t('complete_job')}
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
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
              
              {formData.status === 'cancel_pending' && isAdmin && (
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={handleApproveCancel}
                    disabled={submitting}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {t('approve_cancel')}
                  </button>
                  <button 
                    type="button"
                    onClick={handleRejectCancel}
                    disabled={submitting}
                    className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all flex items-center gap-2 shadow-lg shadow-red-100"
                  >
                    <X className="w-4 h-4" />
                    {t('reject_cancel')}
                  </button>
                </div>
              )}

              {(formData.status === 'pending' || formData.status === 'accepted' || (isAdmin && formData.status === 'completed')) && (
                <button 
                  type="button"
                  onClick={() => {
                    setCancelReasonInput('');
                    setShowCancelConfirm(true);
                  }}
                  disabled={submitting || (formData.status as any) === 'cancel_pending'}
                  className="px-4 py-2 bg-slate-200 text-slate-600 rounded-xl font-bold hover:bg-red-50 hover:text-red-600 transition-all flex items-center gap-2 border border-slate-300 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  {formData.status === 'accepted' && !isAdmin ? t('request_cancel') : t('cancel_job')}
                </button>
              )}

              {isAdmin && id && (
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
            </div>

            {id && !isAdmin && formData.status === 'accepted' && (
              <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <button 
                  type="button"
                  onClick={() => handleReportProblem('delay')}
                  disabled={submitting}
                  className="flex-1 sm:flex-none px-4 py-2 bg-amber-100 text-amber-700 rounded-xl font-bold hover:bg-amber-200 transition-all flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  {t('delay')}
                </button>
                <button 
                  type="button"
                  onClick={() => handleReportProblem('accident')}
                  disabled={submitting}
                  className="flex-1 sm:flex-none px-4 py-2 bg-red-100 text-red-700 rounded-xl font-bold hover:bg-red-200 transition-all flex items-center justify-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  {t('accident')}
                </button>
              </div>
            )}

            <button 
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              {t('back')}
            </button>
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
          <div className="bg-red-50 p-6 rounded-3xl border border-red-100 shadow-sm space-y-3">
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
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-slate-800">{t('job_details')}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> {t('report_date')}
              </label>
              <input 
                type="datetime-local" 
                required
                disabled={!!id && !isAdmin}
                value={formData.work_date || ''}
                onChange={async (e) => {
                  const newDate = e.target.value;
                  setFormData(prev => ({ ...prev, work_date: newDate }));
                }}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
                )}
              />
            </div>

            <div className="space-y-1.5">
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
                  setFormData(prev => ({
                    ...prev, 
                    customer_name: customerName,
                    customer_id: selectedCustomerLoc?.id || '',
                    customer_contact_name: selectedCustomerLoc?.contact_name || '',
                    customer_contact_phone: selectedCustomerLoc?.contact_phone || ''
                  }));
                  
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
              <input 
                type="text" 
                disabled={!!id && !isAdmin}
                placeholder={t('contact_name')}
                value={formData.customer_contact_name || ''}
                onChange={e => setFormData({...formData, customer_contact_name: e.target.value})}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
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
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 relative">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> {t('origin')}
              </label>
              <input 
                type="text" 
                required
                disabled={!!id && !isAdmin}
                placeholder={t('origin')}
                value={formData.origin || ''}
                onChange={e => {
                  setFormData({...formData, origin: e.target.value});
                }}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
                )}
              />
            </div>
            <div className="space-y-1.5 relative">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> {t('destination')}
              </label>
              <input 
                type="text" 
                required
                disabled={!!id && !isAdmin}
                placeholder={t('destination')}
                value={formData.destination || ''}
                onChange={e => {
                  setFormData({...formData, destination: e.target.value});
                }}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
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
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Truck className="w-4 h-4" /> {t('car_number')}
              </label>
              <Select
                isDisabled={!!id && !isAdmin}
                className="react-select-container"
                classNamePrefix="react-select"
                placeholder={t('select_vehicle')}
                options={filteredCars.map(car => {
                  const assignedNames = car.car_users?.map((cu: any) => {
                    const user = cu.line_user_id;
                    if (!user) return null;
                    const name = user.display_name || (user.first_name ? `${user.first_name} ${user.last_name}` : null);
                    return name;
                  }).filter(Boolean).join(', ');
                  const driverName = assignedNames || car.owner_name || '';
                  const vehicleType = car.vehicle_type ? ` [${car.vehicle_type}]` : '';
                  
                  return {
                    value: car.id,
                    label: `${car.car_number}${vehicleType} ${driverName ? `(${driverName})` : ''}`,
                    data: car
                  };
                })}
                value={formData.car_id ? { 
                  value: formData.car_id, 
                  label: cars.find(c => String(c.id) === String(formData.car_id))?.car_number || formData.car_id 
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
                  setFormData(prev => ({
                    ...prev, 
                    car_id: carId, 
                    vehicle_type: selectedCar?.vehicle_type || '',
                    current_mileage: selectedCar?.current_mileage,
                    next_maintenance_date: selectedCar?.next_maintenance_date,
                    next_maintenance_mileage: selectedCar?.next_maintenance_mileage
                  }));
                  
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

                    // Auto-fill driver if car is assigned to a driver
                    const driverMember = selectedCar.car_users.find((cu: any) => {
                      const user = cu.line_user_id;
                      return user && (typeof user === 'object' ? user.role === 'driver' : false);
                    })?.line_user_id as Member | undefined;

                    if (driverMember) {
                      setFormData(prev => ({
                        ...prev, 
                        driver_id: driverMember.id,
                        phone: driverMember.phone || prev.phone
                      }));
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
                <div className="mt-2 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1 border border-slate-100">
                  <p><strong>{t('current_mileage')}:</strong> {formData.current_mileage || '-'}</p>
                  <p><strong>{t('next_maintenance_date')}:</strong> {formData.next_maintenance_date ? new Date(formData.next_maintenance_date).toLocaleDateString() : '-'}</p>
                  <p><strong>{t('next_maintenance_mileage')}:</strong> {formData.next_maintenance_mileage || '-'}</p>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Truck className="w-4 h-4" /> {t('vehicle_type') || 'Vehicle Type'}
              </label>
              <input 
                type="text" 
                disabled={!!id && !isAdmin}
                placeholder={t('vehicle_type') || 'e.g. 4-wheel, 6-wheel'}
                value={formData.vehicle_type || ''}
                onChange={e => setFormData({...formData, vehicle_type: e.target.value})}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
                )}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4" /> {t('driver_name')}
              </label>
              <select 
                required
                disabled={!!id && !isAdmin}
                value={formData.driver_id}
                onChange={e => {
                  const selectedId = e.target.value;
                  const member = members.find(m => String(m.id) === String(selectedId));
                  const memberPhone = member?.phone || (member as any)?.Phone || (member as any)?.phone_number || '';
                  setFormData(prev => ({
                    ...prev, 
                    driver_id: selectedId,
                    phone: memberPhone
                  }));
                }}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary appearance-none transition-all",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
                )}
              >
                <option value="">{t('select_driver')}</option>
                {members.filter(m => m.role === 'driver').map(member => {
                  const busy = isDriverBusy(member.id);
                  const statusText = busy ? ` (${t('busy')})` : ` (${t('available')})`;
                  return (
                    <option key={member.id} value={member.id} className={busy ? "text-red-500" : "text-green-500"}>
                      {member.first_name} {member.last_name} {statusText}
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
                (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
              )}
            />
            {(() => {
              const smsEnabled = localStorage.getItem('line_notifications_enabled') !== 'false';
              if (!smsEnabled) {
                return (
                  <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3" />
                    {t('sms_disabled_warning')}
                  </p>
                );
              }
              return (
                <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                  <MessageSquare className="w-3 h-3" />
                  {t('sms_will_be_sent')}
                </p>
              );
            })()}
          </div>
        </div>

        {/* Time & Mileage Section */}
        {id && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-bold text-slate-800">{t('time')} {t('and')} {t('mileage')}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> {t('standby_time')}
                </label>
                <input 
                  type="datetime-local" 
                  disabled={!isEditable || isFieldLocked('standby_time')}
                  value={formData.standby_time || ''}
                  onChange={e => setFormData({...formData, standby_time: e.target.value})}
                  className={clsx(
                    "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                    (!isEditable || isFieldLocked('standby_time')) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> {t('departure_time')}
                </label>
                <input 
                  type="datetime-local" 
                  disabled={!isEditable || isFieldLocked('departure_time')}
                  value={formData.departure_time || ''}
                  onChange={e => setFormData({...formData, departure_time: e.target.value})}
                  className={clsx(
                    "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                    (!isEditable || isFieldLocked('departure_time')) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> {t('arrival_time')}
                </label>
                <input 
                  type="datetime-local" 
                  disabled={!isEditable || isFieldLocked('arrival_time')}
                  value={formData.arrival_time || ''}
                  onChange={e => {
                    const arrivalTime = e.target.value;
                    if (formData.departure_time && arrivalTime && new Date(arrivalTime) < new Date(formData.departure_time)) {
                      setError(t('arrival_before_departure') || 'Arrival time cannot be before departure time');
                    } else {
                      setError('');
                    }
                    setFormData({...formData, arrival_time: arrivalTime});
                  }}
                  className={clsx(
                    "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                    (!isEditable || isFieldLocked('arrival_time')) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Gauge className="w-4 h-4" /> {t('mileage_start')}
                </label>
                <input 
                  type="number" 
                  disabled={!isEditable || isFieldLocked('mileage_start')}
                  placeholder="0"
                  value={formData.mileage_start || ''}
                  onChange={e => setFormData({...formData, mileage_start: e.target.value})}
                  className={clsx(
                    "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                    (!isEditable || isFieldLocked('mileage_start')) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Gauge className="w-4 h-4" /> {t('mileage_end')}
                </label>
                <input 
                  type="number" 
                  disabled={!isEditable || isFieldLocked('mileage_end')}
                  placeholder="0"
                  value={formData.mileage_end || ''}
                  onChange={e => setFormData({...formData, mileage_end: e.target.value})}
                  className={clsx(
                    "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                    (!isEditable || isFieldLocked('mileage_end')) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Truck className="w-4 h-4" /> {t('total_distance')}
                </label>
                <div className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-slate-700 font-bold flex items-center justify-between">
                  <span>{totalDistance.toLocaleString()}</span>
                  <span className="text-xs text-slate-400 font-normal">km</span>
                </div>
              </div>
            </div>

            {formData.car_id && formData.mileage_start && parseFloat(formData.mileage_start) < getLastMileage(formData.car_id) && (
              <div className="p-4 bg-red-50 rounded-2xl border border-red-200 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-red-800">{t('mileage_error')}</p>
                  <p className="text-xs text-red-700">
                    {t('mileage_less_than_previous', { mileage: getLastMileage(formData.car_id) })}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Photos & Notes Section */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Camera className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-bold text-slate-800">{t('photos')} {t('and')} {t('notes')}</h3>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Camera className="w-4 h-4" /> {t('upload_photos')}
            </label>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {photoPreviews.map((preview, index) => {
                // Find metadata for this photo
                let meta: any = null;
                if (index < existingPhotos.length) {
                  const fileId = existingPhotos[index];
                  meta = formData.photo_metadata?.find((m: any) => m.file_id === fileId);
                } else {
                  const newPhotoIndex = index - existingPhotos.length;
                  meta = photos[newPhotoIndex]?.metadata;
                }

                return (
                  <div key={index} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 group">
                    <img 
                      src={preview} 
                      alt="Preview" 
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                      referrerPolicy="no-referrer"
                      onClick={() => setFullscreenImage(preview)}
                    />
                    
                    {meta && (
                      <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/50 text-[8px] text-white leading-tight">
                        {meta.timestamp && <div>{meta.timestamp}</div>}
                        {meta.latitude && <div>GPS: {meta.latitude.toFixed(4)}, {meta.longitude.toFixed(4)}</div>}
                      </div>
                    )}

                    <button 
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              <label className={clsx(
                "aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 transition-colors",
                !isEditable ? "bg-slate-100 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"
              )}>
                <Plus className="w-6 h-6 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">{t('add_photo')}</span>
                <input 
                  type="file" 
                  multiple 
                  disabled={!isEditable}
                  accept="image/*" 
                  onChange={handlePhotoChange} 
                  className="hidden" 
                />
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <FileText className="w-4 h-4" /> {t('notes')}
            </label>
            <textarea 
              rows={3}
              disabled={!isEditable}
              placeholder={t('notes')}
              value={formData.notes || ''}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className={clsx(
                "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all resize-none",
                !isEditable ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
              )}
            />
          </div>
        </div>


        <button 
          type="submit"
          disabled={submitting || !isEditable}
          className="w-full bg-primary text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {id ? t('loading') : t('loading')}
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              {id ? t('submit_report') : t('submit_report')}
            </>
          )}
        </button>
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

      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center">
              <div className={clsx(
                "w-20 h-20 rounded-full flex items-center justify-center mb-6",
                statusConfig.type === 'success' ? "bg-emerald-50 text-emerald-500" : "bg-red-50 text-red-500"
              )}>
                {statusConfig.type === 'success' ? (
                  <CheckCircle2 className="w-10 h-10" />
                ) : (
                  <AlertCircle className="w-10 h-10" />
                )}
              </div>
              
              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                {statusConfig.title}
              </h3>
              
              <p className="text-slate-500 mb-8">
                {statusConfig.message}
              </p>
              
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  if (statusConfig.action) statusConfig.action();
                }}
                className={clsx(
                  "w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg",
                  statusConfig.type === 'success' ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100" : "bg-red-500 hover:bg-red-600 shadow-red-100"
                )}
              >
                {statusConfig.type === 'success' ? t('save') : t('try_again')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={showCancelConfirm}
        title={formData.status === 'accepted' && !isAdmin ? t('request_cancel') : t('cancel_job')}
        message={
          <div className="space-y-4">
            <p>{t('confirm_cancel_job')}</p>
            {formData.status === 'accepted' && !isAdmin && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {t('cancel_reason')}
                </label>
                <textarea
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                  rows={3}
                  placeholder={t('enter_cancel_reason')}
                />
              </div>
            )}
          </div>
        }
        onConfirm={handleCancelJob}
        onCancel={() => setShowCancelConfirm(false)}
        confirmText={formData.status === 'accepted' && !isAdmin ? t('request_cancel') : t('cancel_job')}
      />

      <ConfirmModal 
        isOpen={showDeleteConfirm}
        title={t('delete')}
        message={t('confirm_delete')}
        onConfirm={confirmDeleteJob}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText={t('delete')}
        isDestructive={true}
      />
    </div>
  );
};
