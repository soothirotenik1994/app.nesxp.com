export interface Member {
  id: string;
  line_user_id: string;
  display_name?: string;
  picture_url?: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  password?: string;
  role?: 'driver' | 'customer';
  created_at: string;
  date_created?: string;
  registration_source?: 'line' | 'admin';
  car_users?: {
    car_id: Car;
  }[];
  cars?: any[];
}

export interface Car {
  id: string;
  car_number: string;
  vehicle_type?: string;
  description: string;
  owner_name?: string;
  driver_phone?: string;
  car_image?: string | { id: string };
  car_users?: {
    line_user_id: Member;
  }[];
  line_users?: any[];
}

export interface CarPermission {
  id: string;
  line_user_id: string;
  car_id: string;
}

export interface CarStatus {
  carNumber: string;
  driverName?: string;
  driverPhone?: string;
  lat: number;
  lng: number;
  speed: number;
  address: string;
  lastUpdate: string;
  status: 'online' | 'offline';
}

export interface User {
  email: string;
  token: string;
}

export interface AdminUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  line_user_id?: string;
  role?: string | { id: string; name: string };
  avatar?: string;
  status?: string;
}

export interface CustomerLocation {
  id: string;
  company_name: string;
  tax_id?: string;
  phone?: string;
  email?: string;
  address?: string;
  branch?: string;
  contact_name?: string;
  contact_phone?: string;
  member_id?: string | Member;
  members?: {
    line_user_id: Member;
  }[];
  date_created?: string;
}

export interface WorkReport {
  id: string;
  case_number?: string;
  UUID?: string;
  work_date: string;
  customer_name: string;
  customer_contact_name?: string;
  customer_contact_phone?: string;
  origin: string;
  origin_lat?: number;
  origin_lng?: number;
  destination: string;
  destination_lat?: number;
  destination_lng?: number;
  vehicle_type?: string;
  car_id: string | Car;
  driver_id: string | Member;
  customer_id?: string | CustomerLocation;
  phone: string;
  standby_time: string;
  departure_time: string;
  arrival_time: string;
  mileage_start?: number;
  mileage_end?: number;
  notes?: string;
  photos?: string[];
  photo_metadata?: {
    file_id: string;
    latitude?: number;
    longitude?: number;
    timestamp?: string;
  }[];
  status?: 'pending' | 'accepted' | 'cancelled' | 'completed' | 'cancel_pending';
  date_created?: string;
  status_logs?: {
    status: string;
    timestamp: string;
    notes?: string;
  }[];
}
