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
  car_users?: {
    car_id: Car;
  }[];
  cars?: any[];
}

export interface Car {
  id: string;
  car_number: string;
  description: string;
  owner_name?: string;
  driver_phone?: string;
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
  role?: string;
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
  date_created?: string;
}

export interface WorkReport {
  id: string;
  case_number?: string;
  work_date: string;
  customer_name: string;
  origin: string;
  destination: string;
  car_id: string | Car;
  driver_id: string | Member;
  phone: string;
  standby_time: string;
  departure_time: string;
  arrival_time: string;
  mileage_yard: number;
  mileage_start: number;
  mileage_end: number;
  notes?: string;
  photos?: string[];
  status?: 'pending' | 'accepted' | 'cancelled' | 'completed' | 'cancel_pending';
  date_created?: string;
}
