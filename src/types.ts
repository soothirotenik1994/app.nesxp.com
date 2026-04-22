export interface MaintenanceHistory {
  id: string;
  car_id: string | Car;
  date: string;
  mileage: number;
  service_type: string;
  cost?: number;
  notes?: string;
}

export interface Member {
  id: string;
  line_user_id?: string;
  google_user_id?: string;
  display_name?: string;
  picture_url?: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address?: string;
  password?: string;
  role?: 'member' | 'customer' | 'general' | 'driver';
  status?: 'active' | 'inactive' | 'pending';
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
  brand_id?: string | CarBrand;
  description: string;
  owner_name?: string;
  member_phone?: string;
  company_code?: string;
  car_image?: string | { id: string };
  car_users?: {
    line_user_id: Member;
  }[];
  line_users?: any[];
  status?: 'active' | 'inactive';
  maintenance_status?: 'normal' | 'maintenance';
  next_maintenance_date?: string;
  next_maintenance_mileage?: number;
  current_mileage?: number;
}

export interface CarBrand {
  id: string;
  name: string;
}

export interface CarPermission {
  id: string;
  line_user_id: string;
  car_id: string;
}

export interface CarStatus {
  carNumber: string;
  memberName?: string;
  memberPhone?: string;
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
  company_code?: string;
  tax_id?: string;
  phone?: string;
  email?: string;
  address?: string;
  branch?: string;
  member_id?: string | Member;
  members?: {
    id: string;
    line_user_id: Member;
  }[];
  date_created?: string;
}

export interface Waypoint {
  name: string;
  url: string;
  lat?: number;
  lng?: number;
}

export interface TripPoint {
  name: string;
  url: string;
  lat?: number;
  lng?: number;
  contact_name?: string;
  contact_phone?: string;
  time?: string;
}

export interface Trip {
  type: 'outbound' | 'return';
  pickups: TripPoint[];
  deliveries: TripPoint[];
  distance?: number;
}

export interface Route {
  origin?: string;
  origin_url?: string;
  origin_lat?: number;
  origin_lng?: number;
  destination?: string;
  destination_url?: string;
  destination_lat?: number;
  destination_lng?: number;
  distance?: number;
  route_type?: 'upcountry' | 'bangkok_vicinity' | string;
  // New fields for multi-drop
  type?: 'outbound' | 'return';
  pickups?: TripPoint[];
  deliveries?: TripPoint[];
  status?: 'pending' | 'completed';
  date?: string;
  standby_time?: string;
  departure_time?: string;
  arrival_time?: string;
  mileage_start?: string | number;
  mileage_end?: string | number;
}

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
}

export interface WorkReport {
  id: string;
  case_number?: string;
  UUID?: string;
  job_type?: 'one_way' | 'round_trip' | string;
  work_date: string;
  customer_name: string;
  customer_contact_name?: string;
  customer_contact_phone?: string;
  origin: string;
  origin_url?: string;
  origin_lat?: number;
  origin_lng?: number;
  destination: string;
  destination_url?: string;
  destination_lat?: number;
  destination_lng?: number;
  waypoints?: Waypoint[];
  routes?: Route[];
  estimated_distance?: number;
  vehicle_type?: string;
  car_id: string | Car;
  member_id: string | Member;
  driver_id?: string | Member;
  customer_id?: string | CustomerLocation;
  phone: string;
  standby_time: string;
  departure_time: string;
  arrival_time: string;
  mileage_start?: string | number;
  mileage_end?: string | number;
  notes?: string;
  photos?: string[];
  pickup_photos?: string[];
  delivery_photos?: string[];
  signature_pickup?: string;
  signature_delivery?: string;
  signature?: string;
  signature_name?: string;
  photo_document?: string[];
  photo_metadata?: {
    file_id: string;
    latitude?: number;
    longitude?: number;
    timestamp?: string;
  }[];
  toll_fee?: number | string;
  fuel_cost?: number | string;
  other_expenses?: number | string;
  other_expenses_note?: string;
  expense_items?: ExpenseItem[];
  status?: 'pending' | 'accepted' | 'cancelled' | 'completed' | 'cancel_pending' | 'deleted';
  cancel_reason?: string;
  acceptance_deadline?: string;
  accepted_at?: string;
  date_created?: string;
  status_logs?: {
    status: string;
    timestamp: string;
    notes?: string;
  }[];
  actual_arrived_lat?: number;
  actual_arrived_lng?: number;
  actual_completed_lat?: number;
  actual_completed_lng?: number;
  is_geofence_verified?: boolean;
  rating?: number;
  feedback?: string;
  rated_at?: string;
  advance_opening_time?: string;
  notify_driver_24h_before?: boolean;
  notification_24h_sent?: boolean;
}

export interface SystemSettings {
  id: number;
  website_name?: string;
  website_logo?: string;
  website_background?: string;
  app_url?: string;
  google_maps_api_key?: string;
  enable_queue_system?: boolean;
  bkk_max_distance?: number;
  enable_tracking?: boolean;
  enable_line_login?: boolean;
  enable_google_login?: boolean;
  google_client_id?: string;
  email_smtp_host?: string;
  email_smtp_port?: string;
  email_smtp_user?: string;
  email_smtp_password?: string;
  email_smtp_secure?: boolean;
  email_from?: string;
  email_from_name?: string;
  expense_categories?: string | string[];
}
