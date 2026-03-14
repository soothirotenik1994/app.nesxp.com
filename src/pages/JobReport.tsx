import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { directusApi, api } from '../api/directus';
import { lineService } from '../services/lineService';
import { Car, Member, CustomerLocation } from '../types';
import clsx from 'clsx';
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
  X,
  Plus,
  AlertCircle,
  Trash2,
  AlertTriangle,
  MessageSquare
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

export const JobReport: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const userRole = localStorage.getItem('user_role') || 'Driver';
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
  const [cancelReasonInput, setCancelReasonInput] = useState('');

  const [formData, setFormData] = useState({
    case_number: '',
    work_date: new Date().toISOString().split('T')[0],
    customer_name: '',
    origin: '',
    destination: '',
    car_id: '',
    driver_id: '',
    phone: '',
    standby_time: '',
    departure_time: '',
    arrival_time: '',
    mileage_start: '',
    mileage_end: '',
    notes: '',
    status: 'pending',
    cancel_reason: ''
  });

  const generateNextCaseNumber = async (dateStr: string) => {
    try {
      // dateStr is YYYY-MM-DD
      const datePart = dateStr.replace(/-/g, ''); // YYYYMMDD
      
      const response = await api.get('/items/work_reports', {
        params: {
          filter: {
            case_number: { _starts_with: datePart }
          },
          sort: '-case_number',
          limit: 1,
          fields: 'case_number'
        }
      });

      const lastReport = response.data.data[0];
      let nextSeq = 1;

      if (lastReport && lastReport.case_number) {
        const parts = lastReport.case_number.split('-');
        if (parts.length === 2) {
          const lastSeq = parseInt(parts[1], 10);
          if (!isNaN(lastSeq)) {
            nextSeq = lastSeq + 1;
          }
        }
      }

      const seqPart = String(nextSeq).padStart(3, '0');
      return `${datePart}-${seqPart}`;
    } catch (err) {
      console.error('Error generating case number:', err);
      const datePart = dateStr.replace(/-/g, '');
      return `${datePart}-001`; // Fallback
    }
  };

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
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [initialValues, setInitialValues] = useState<any>({});
  
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
          const [c, m, cl] = await Promise.all([
            directusApi.getCars(),
            directusApi.getMembers(),
            directusApi.getCustomerLocations()
          ]);
          carsData = c;
          membersData = m;
          customersData = cl;
        } catch (fetchErr: any) {
          console.error('Initial fetch error in JobReport:', fetchErr);
          // If members fail but user is admin, we might still want to see the form
          if (fetchErr.message?.includes('line_users')) {
            const [c, cl] = await Promise.all([
              directusApi.getCars(),
              directusApi.getCustomerLocations()
            ]);
            carsData = c;
            customersData = cl;
          } else {
            throw fetchErr;
          }
        }

        setCars(carsData);
        setMembers(membersData);
        setCustomers(customersData);

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
            case_number: report.case_number || '',
            work_date: (report.work_date || report.date_created || '').split('T')[0].split(' ')[0],
            customer_name: report.customer_name || '',
            origin: report.origin || '',
            destination: report.destination || '',
            car_id: report.car_id?.id || report.car_id || '',
            driver_id: report.driver_id?.id || report.driver_id || '',
            phone: report.phone || '',
            standby_time: formatTimeForInput(report.standby_time),
            departure_time: formatTimeForInput(report.departure_time),
            arrival_time: formatTimeForInput(report.arrival_time),
            mileage_start: report.mileage_start !== null && report.mileage_start !== undefined ? report.mileage_start.toString() : '',
            mileage_end: report.mileage_end !== null && report.mileage_end !== undefined ? report.mileage_end.toString() : '',
            notes: report.notes || '',
            status: report.status || 'pending',
            cancel_reason: report.cancel_reason || ''
          };
          
          setFormData(initialData);
          setInitialValues(initialData);
          
          if (report.photos && Array.isArray(report.photos)) {
            const photoIds = report.photos.map((p: any) => typeof p === 'string' ? p : p.id);
            setExistingPhotos(photoIds);
            const previews = photoIds.map((fileId: string) => `${import.meta.env.VITE_DIRECTUS_URL}/assets/${fileId}`);
            setPhotoPreviews(previews);
          }
        } else {
          // New report: Generate case number
          const nextCaseNumber = await generateNextCaseNumber(formData.work_date);
          setFormData(prev => ({ ...prev, case_number: nextCaseNumber }));

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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      setPhotos(prev => [...prev, ...newFiles]);
      
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPhotoPreviews(prev => [...prev, ...newPreviews]);
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
      // 1. Upload new photos to Directus if any
      const uploadedPhotoIds: string[] = [];
      if (photos.length > 0) {
        for (const photo of photos) {
          const formDataFile = new FormData();
          formDataFile.append('file', photo);
          const response = await api.post('/files', formDataFile);
          uploadedPhotoIds.push(response.data.data.id);
        }
      }

      // 2. Prepare report data
      const reportData: any = {};
      
      const formatTime = (t: string) => {
        if (!t) return undefined;
        // t is YYYY-MM-DDTHH:mm from datetime-local
        return t.replace('T', ' ') + ':00';
      };

      // Add fields only if they have values to support partial updates
      const standby = formatTime(formData.standby_time);
      if (standby) reportData.standby_time = standby;

      const departure = formatTime(formData.departure_time);
      if (departure) reportData.departure_time = departure;

      const arrival = formatTime(formData.arrival_time);
      if (arrival) reportData.arrival_time = arrival;

      if (formData.mileage_start !== '') {
        reportData.mileage_start = parseInt(formData.mileage_start.toString());
      }
      
      if (formData.mileage_end !== '') {
        reportData.mileage_end = parseInt(formData.mileage_end.toString());
        // If driver finishes the job, mark as completed
        if (formData.status === 'accepted') {
          reportData.status = 'completed';
        }
      }

      if (formData.notes) {
        reportData.notes = formData.notes;
      }

      if (formData.case_number) reportData.case_number = formData.case_number;
      if (!id || isAdmin) {
        // New report OR Admin can edit everything
        // For new reports, we include the basic info
        if (formData.work_date) {
        // If work_date is DateTime in Directus, we send it with 00:00:00
        reportData.work_date = `${formData.work_date} 00:00:00`;
      }
        if (formData.customer_name) reportData.customer_name = formData.customer_name;
        if (formData.origin) reportData.origin = formData.origin;
        if (formData.destination) reportData.destination = formData.destination;
        if (formData.phone) reportData.phone = formData.phone;
        if (formData.car_id) reportData.car_id = formData.car_id;
        if (formData.driver_id) reportData.driver_id = formData.driver_id;
      }

      if (uploadedPhotoIds.length > 0 || existingPhotos.length > 0) {
        reportData.photos = [...existingPhotos, ...uploadedPhotoIds];
      }
      
      console.log('Submitting report data:', reportData);

      if (id) {
        console.log('Updating existing report...');
        await directusApi.updateWorkReport(id, reportData);
        console.log('Update successful');
        
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
        
        // Send LINE notification to driver
        try {
          const notificationsEnabled = localStorage.getItem('sms_enabled') !== 'false'; // Reusing the same setting for now
          const driver = members.find(m => String(m.id) === String(formData.driver_id));
          const lineId = driver?.line_user_id;

          if (notificationsEnabled && lineId) {
            const selectedCar = cars.find(c => String(c.id) === String(formData.car_id));
            const accountSource = driver?.line_user_id ? '(สมัครผ่าน LINE)' : '(Admin สร้าง)';
            const driverName = driver ? `${driver.first_name} ${driver.last_name} ${accountSource}` : 'N/A';
            
            const messages = [
              {
                type: "text",
                text: `🔔 มีงานใหม่มอบหมายให้คุณ\n\n🏢 ลูกค้า: ${formData.customer_name}\n📍 ต้นทาง: ${formData.origin}\n🏁 ปลายทาง: ${formData.destination}\n🚚 รถ: ${selectedCar?.car_number || ''}\n📅 วันที่: ${formData.work_date}`
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
          
          // Add a notification if LINE fails
          setStatusConfig({
            type: 'error',
            title: 'การแจ้งเตือน LINE ล้มเหลว',
            message: `บันทึกงานแล้ว แต่ไม่สามารถส่งการแจ้งเตือน LINE ได้: ${errorDetails}`,
            action: () => setShowStatusModal(false)
          });
          setShowStatusModal(true);
          return; // Stop here to let the user see the error
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
      const errorMsg = error.response?.data?.errors?.[0]?.message || error.message || t('error_saving_report');
      
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

  const handleAcceptJob = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await directusApi.updateWorkReport(id, { status: 'accepted' });
      setFormData(prev => ({ ...prev, status: 'accepted' }));
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

  const isEditable = !id || isAdmin || (formData.status === 'accepted' && formData.status !== 'cancel_pending');
  const isPendingCancel = formData.status === 'cancel_pending';
  const selectedMember = members.find(m => String(m.id) === String(formData.driver_id));

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

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{id ? t('update_job_details') : t('new_job_assignment_title')}</h2>
          <p className="text-slate-500">{id ? t('update_job_desc') : t('assign_new_job_desc')}</p>
        </div>
        {id && (
          <div className="flex flex-wrap items-center gap-2">
            {formData.status === 'pending' && (
              <button 
                type="button"
                onClick={handleAcceptJob}
                disabled={submitting}
                className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100"
              >
                <CheckCircle2 className="w-4 h-4" />
                {t('accept_job')}
              </button>
            )}

            {isAdmin && formData.status === 'accepted' && (
              <button 
                type="button"
                onClick={handleCompleteJob}
                disabled={submitting}
                className="px-4 py-2 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-all flex items-center gap-2 shadow-lg shadow-blue-100"
              >
                <CheckCircle2 className="w-4 h-4" />
                {t('complete_job')}
              </button>
            )}

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
                disabled={submitting || formData.status === 'cancel_pending'}
                className="px-4 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all flex items-center gap-2 shadow-lg shadow-orange-100 disabled:opacity-50"
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
                <Hash className="w-4 h-4" /> {t('case_number') || 'Case Number'}
              </label>
              <input 
                type="text" 
                placeholder="YYYYMMDD-XXX"
                disabled={!!id && !isAdmin}
                value={formData.case_number}
                onChange={e => setFormData({...formData, case_number: e.target.value})}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
                )}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> {t('report_date')}
              </label>
              <input 
                type="date" 
                required
                disabled={!!id && !isAdmin}
                value={formData.work_date}
                onChange={async (e) => {
                  const newDate = e.target.value;
                  setFormData(prev => ({ ...prev, work_date: newDate }));
                  if (!id) {
                    const nextCaseNumber = await generateNextCaseNumber(newDate);
                    setFormData(prev => ({ ...prev, case_number: nextCaseNumber }));
                  }
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
              <select 
                required
                disabled={!!id && !isAdmin}
                value={formData.customer_name}
                onChange={e => {
                  const customerName = e.target.value;
                  setFormData(prev => ({...prev, customer_name: customerName}));
                  
                  // Auto-fill car if there's only one car assigned to this customer
                  if (isAdmin && customerName) {
                    const selectedCustomerLoc = customers.find(c => c.company_name === customerName);
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
                        if (assignedCars.length === 1) {
                          setFormData(prev => ({...prev, car_id: assignedCars[0].id}));
                        }
                      }
                    }
                  }
                }}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary appearance-none transition-all",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
                )}
              >
                <option value="">{t('select_customer')}</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.company_name}>
                    {customer.company_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> {t('origin')}
              </label>
              <input 
                type="text" 
                required
                disabled={!!id && !isAdmin}
                placeholder={t('origin')}
                value={formData.origin}
                onChange={e => setFormData({...formData, origin: e.target.value})}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
                )}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> {t('destination')}
              </label>
              <input 
                type="text" 
                required
                disabled={!!id && !isAdmin}
                placeholder={t('destination')}
                value={formData.destination}
                onChange={e => setFormData({...formData, destination: e.target.value})}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Truck className="w-4 h-4" /> {t('car_number')}
              </label>
              <select 
                required
                disabled={!!id && !isAdmin}
                value={formData.car_id}
                onChange={e => {
                  const carId = e.target.value;
                  setFormData(prev => ({...prev, car_id: carId}));
                  
                  // Auto-fill customer if car is assigned to a customer
                  if (isAdmin && carId) {
                    const selectedCar = cars.find(c => String(c.id) === String(carId));
                    if (selectedCar && selectedCar.car_users) {
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
                  }
                }}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary appearance-none transition-all",
                  (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
                )}
              >
                <option value="">{t('select_vehicle')}</option>
                {filteredCars.map(car => {
                  const assignedNames = car.car_users?.map((cu: any) => {
                    const user = cu.line_user_id;
                    if (!user) return null;
                    const source = user.line_user_id ? '(สมัครผ่าน LINE)' : '(Admin สร้าง)';
                    const name = user.display_name || (user.first_name ? `${user.first_name} ${user.last_name}` : null);
                    return name ? `${name} ${source}` : null;
                  }).filter(Boolean).join(', ');
                  const driverName = assignedNames || car.owner_name || '';
                  return (
                    <option key={car.id} value={car.id}>
                      {car.car_number} {driverName ? `(${driverName})` : ''}
                    </option>
                  );
                })}
              </select>
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
                {members.filter(m => m.role === 'driver').map(member => (
                  <option key={member.id} value={member.id}>
                    {member.first_name} {member.last_name} {member.line_user_id ? '(สมัครผ่าน LINE)' : '(Admin สร้าง)'}
                  </option>
                ))}
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
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              className={clsx(
                "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                (!!id && !isAdmin) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
              )}
            />
            {(() => {
              const smsEnabled = localStorage.getItem('sms_enabled') !== 'false';
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
                  value={formData.standby_time}
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
                  value={formData.departure_time}
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
                  value={formData.arrival_time}
                  onChange={e => setFormData({...formData, arrival_time: e.target.value})}
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
                  value={formData.mileage_start}
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
                  value={formData.mileage_end}
                  onChange={e => setFormData({...formData, mileage_end: e.target.value})}
                  className={clsx(
                    "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all",
                    (!isEditable || isFieldLocked('mileage_end')) ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
                  )}
                />
              </div>
            </div>
          </div>
        )}

        {/* Photos & Notes Section */}
        {id && (
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
                {photoPreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 group">
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
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
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                className={clsx(
                  "w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all resize-none",
                  !isEditable ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus:bg-white"
                )}
              />
            </div>
          </div>
        )}

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

      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
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
