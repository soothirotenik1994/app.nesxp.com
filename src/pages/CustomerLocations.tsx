import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { CustomerLocation, Member } from '../types';
import { clsx } from 'clsx';
import { Search, Plus, MapPin, Edit2, Trash2, X, Loader2, AlertCircle, Building2, User, Phone, Mail, FileText, Map, Users, Hash, GripVertical, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import Select from 'react-select';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable,
  rectIntersection,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableMemberProps {
  member: Member;
  onRemove?: (id: string) => void;
  onAdd?: (id: string) => void;
  isOverlay?: boolean;
}

const SortableMember: React.FC<SortableMemberProps> = ({ member, onRemove, onAdd, isOverlay }) => {
  const { t } = useTranslation();
  if (!member) return null;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: String(member.id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isOverlay ? 1000 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-sm mb-2 group cursor-default",
        isOverlay && "shadow-xl border-primary/30 ring-2 ring-primary/10"
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-primary transition-colors">
        <GripVertical className="w-4 h-4" />
      </div>
      
      {member.picture_url ? (
        <img 
          src={directusApi.getFileUrl(member.picture_url)} 
          alt="" 
          className="w-10 h-10 rounded-xl object-cover border border-slate-100 shadow-sm"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-100">
          {(member.display_name || member.first_name || 'U').charAt(0).toUpperCase()}
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 truncate">
          {member.display_name || `${member.first_name} ${member.last_name}`}
        </p>
        <div className="flex items-center gap-2">
          {member.role && (
             <span className="text-[9px] font-bold text-primary uppercase tracking-tighter bg-blue-50 px-1 rounded">
               {t(`${member.role}_role`)}
             </span>
          )}
          {member.email && <p className="text-[10px] text-slate-500 truncate">{member.email}</p>}
        </div>
      </div>

      {onAdd && (
        <button 
          type="button"
          onClick={() => onAdd(member.id)}
          className="p-1.5 hover:bg-primary/10 text-primary rounded-lg transition-colors"
          title={t('click_to_add')}
        >
          <Plus className="w-4 h-4" />
        </button>
      )}

      {onRemove && (
        <button 
          type="button"
          onClick={() => onRemove(member.id)}
          className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
          title={t('click_to_remove')}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

const DroppableContainer = ({ id, items, title, onRemove, onAdd, icon: Icon, emptyText }: any) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex-1 flex flex-col min-h-[200px] md:min-h-[300px]">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Icon className="w-3.5 h-3.5 text-primary" />
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</h3>
        <span className="ml-auto text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      
      <div
        ref={setNodeRef}
        className={clsx(
          "flex-1 p-3 rounded-2xl border-2 border-dashed transition-all overflow-y-auto max-h-[400px] scrollbar-hide",
          isOver ? "bg-primary/10 border-primary/40 ring-8 ring-primary/5" : "bg-slate-50/50 border-slate-200"
        )}
      >
        <SortableContext items={items.map((i: any) => String(i.id))} strategy={verticalListSortingStrategy}>
          {items.length > 0 ? (
            items.map((member: any) => (
              <SortableMember 
                key={member.id} 
                member={member} 
                onRemove={onRemove} 
                onAdd={onAdd}
              />
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
              <Icon className="w-6 h-6 mb-2 opacity-20" />
              <p className="text-[10px]">{emptyText}</p>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
};

// Memoized LocationCard component for better mobile layout
const LocationCard = React.memo(({ 
  loc, 
  members, 
  canEdit, 
  onEdit, 
  onDelete 
}: { 
  loc: CustomerLocation, 
  members: Member[],
  canEdit: boolean,
  onEdit: (loc: CustomerLocation) => void,
  onDelete: (id: string) => void
}) => {
  const { t } = useTranslation();

  const assignedMemberIds = useMemo(() => {
    const ids: string[] = [];
    if (loc.members && Array.isArray(loc.members)) {
      loc.members.forEach((m: any) => {
        const id = typeof m.line_user_id === 'object' ? m.line_user_id?.id : m.line_user_id;
        if (id && !ids.includes(String(id))) {
          const memberObj = members.find(mbr => String(mbr.id) === String(id));
          if (memberObj && (memberObj.role === 'member' || memberObj.role === 'driver' || memberObj.role === 'customer')) {
            ids.push(String(id));
          }
        }
      });
    }
    return ids;
  }, [loc.members, members]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all group h-full flex flex-col">
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-primary/5 group-hover:border-primary/10 transition-colors shadow-sm">
              <Building2 className="w-6 h-6 text-slate-400 group-hover:text-primary transition-colors" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 line-clamp-1">{loc.company_name}</h3>
              {loc.company_code && (
                <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                  {loc.company_code}
                </span>
              )}
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-1">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(loc);
                }}
                className="p-2 hover:bg-slate-50 text-slate-400 hover:text-primary rounded-xl transition-colors"
                title={t('edit')}
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(loc.id);
                }}
                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors"
                title={t('delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2.5">
            {loc.tax_id && (
              <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100/50">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-600 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                  {t('tax_id')}: {loc.tax_id}
                </span>
              </div>
            )}
            {loc.branch && (
              <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100/50">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-600 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                  {t('branch')}: {loc.branch}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {loc.phone && (
                <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <a href={`tel:${loc.phone}`} className="hover:text-primary transition-colors">{loc.phone}</a>
                </div>
              )}
              {loc.email && (
                <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <a href={`mailto:${loc.email}`} className="hover:text-primary transition-colors truncate">{loc.email}</a>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {assignedMemberIds.length > 0 && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100/50">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('contact_person')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2 overflow-hidden">
                    {members.filter(m => assignedMemberIds.includes(String(m.id))).slice(0, 3).map((m) => (
                      <div key={m.id} className="inline-block h-7 w-7 rounded-full ring-2 ring-white overflow-hidden bg-white shadow-sm" title={m.display_name || `${m.first_name} ${m.last_name}`}>
                        {m.picture_url ? (
                          <img 
                            src={directusApi.getFileUrl(m.picture_url)} 
                            alt="" 
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[8px] font-bold text-slate-500 uppercase">
                            {(m.display_name || m.first_name || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-600 font-bold ml-1">
                    {(() => {
                      const selectedMembers = members.filter(m => assignedMemberIds.includes(String(m.id)));
                      if (selectedMembers.length === 1) {
                        return selectedMembers[0].display_name || selectedMembers[0].first_name;
                      }
                      if (selectedMembers.length === 2) {
                        return `${selectedMembers[0].display_name || selectedMembers[0].first_name}, ...`;
                      }
                      return `${selectedMembers[0].display_name || selectedMembers[0].first_name} +${selectedMembers.length - 1}`;
                    })()}
                  </p>
                </div>
              </div>
            )}
            {loc.address && (
              <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50">
                <div className="flex items-start gap-2">
                  <Map className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                  <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">{loc.address}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export const CustomerLocations: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<CustomerLocation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [junctionField, setJunctionField] = useState<string>('line_users_id');

  const userRole = (localStorage.getItem('user_role') || '').trim();
  const isAdminStored = localStorage.getItem('is_admin') === 'true';
  const roleLower = userRole.toLowerCase();
  
  // Use a more permissive check for admin roles to ensure visibility
  const isAdmin = isAdminStored || 
                  roleLower.includes('admin') || 
                  roleLower.includes('administrator') || 
                  roleLower.includes('super');
                  
  const isCustomerMember = roleLower === 'customer' || roleLower === 'member';
  const canAddLocation = isAdmin || isCustomerMember || userRole === '';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<CustomerLocation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [originalMembers, setOriginalMembers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    company_name: '',
    company_code: '',
    tax_id: '',
    phone: '',
    email: '',
    address: '',
    branch: '',
    member_ids: [] as string[]
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      console.log('Drag ended with no drop target');
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    
    console.log(`Drag End: active=${activeId}, over=${overId}`);

    const isActiveInSelected = formData.member_ids.map(String).includes(activeId);
    const isOverInSelected = formData.member_ids.map(String).includes(overId) || overId === 'selected-container';
    const isOverInAvailable = !formData.member_ids.map(String).includes(overId) || overId === 'available-container';

    console.log(`Status: isActiveInSelected=${isActiveInSelected}, isOverInSelected=${isOverInSelected}, isOverInAvailable=${isOverInAvailable}`);

    if (isActiveInSelected && isOverInAvailable) {
      console.log('Moving from Selected to Available');
      setFormData(prev => ({
        ...prev,
        member_ids: prev.member_ids.filter(id => String(id) !== activeId)
      }));
    } else if (!isActiveInSelected && isOverInSelected) {
      console.log('Moving from Available to Selected');
      setFormData(prev => ({
        ...prev,
        member_ids: [...prev.member_ids, activeId]
      }));
    } else if (isActiveInSelected && isOverInSelected) {
      console.log('Reordering within Selected');
      if (activeId !== overId) {
        setFormData(prev => {
          const oldIndex = prev.member_ids.map(String).indexOf(activeId);
          const newIndex = prev.member_ids.map(String).indexOf(overId);
          
          if (newIndex === -1) return prev;
          
          return {
            ...prev,
            member_ids: arrayMove(prev.member_ids, oldIndex, newIndex)
          };
        });
      }
    }
  };

  const handleAddMember = (memberId: any) => {
    const idStr = String(memberId);
    const currentIds = formData.member_ids.map(String);
    if (!currentIds.includes(idStr)) {
      setFormData(prev => ({
        ...prev,
        member_ids: [...prev.member_ids, idStr]
      }));
    }
    setMemberSearchTerm('');
  };

  const handleRemoveMember = (memberId: any) => {
    const idStr = String(memberId);
    setFormData(prev => ({
      ...prev,
      member_ids: prev.member_ids.filter(id => String(id) !== idStr)
    }));
  };

  const availableMembers = members.filter(m => 
    (m.role === 'customer' || m.role === 'member') && 
    !formData.member_ids.map(String).includes(String(m.id)) &&
    (
      (m.display_name || '').toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
      (m.first_name || '').toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
      (m.last_name || '').toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
      (m.email || '').toLowerCase().includes(memberSearchTerm.toLowerCase())
    )
  );

  const selectedMembersList = members.filter(m => formData.member_ids.map(String).includes(String(m.id)))
    .sort((a, b) => formData.member_ids.map(String).indexOf(String(a.id)) - formData.member_ids.map(String).indexOf(String(b.id)));

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [locationsData, membersData] = await Promise.all([
        directusApi.getCustomerLocations(),
        directusApi.getMembers()
      ]);
      console.log('Fetched Locations:', locationsData.length);
      setLocations(locationsData);
      setMembers(membersData);

      // Detect junction field from existing data
      if (locationsData.length > 0) {
        const locWithMembers = locationsData.find(l => l.members && l.members.length > 0);
        if (locWithMembers && locWithMembers.members) {
          const m = locWithMembers.members[0] as any;
          console.log('Detecting junction field from sample member:', m);
          if (m.line_users_id !== undefined) {
            console.log('Detected junction field: line_users_id');
            setJunctionField('line_users_id');
          } else if (m.members_id !== undefined) {
            console.log('Detected junction field: members_id');
            setJunctionField('members_id');
          } else if (m.line_user_id !== undefined) {
            console.log('Detected junction field: line_user_id');
            setJunctionField('line_user_id');
          }
        }
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        return;
      }
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (location?: CustomerLocation) => {
    if (location) {
      console.log('Opening Modal for Location:', location.id);
      console.log('Location Members:', location.members);
      setEditingLocation(location);
      setOriginalMembers(location.members || []);
      
      // Extract member IDs from members array
      const memberIds: string[] = [];
      
      if (location.members && Array.isArray(location.members)) {
        location.members.forEach((m: any) => {
          const id = typeof m.line_users_id === 'object' ? m.line_users_id?.id :
                     (typeof m.line_user_id === 'object' ? m.line_user_id?.id : 
                     (typeof m.members_id === 'object' ? m.members_id?.id : (m.line_users_id || m.line_user_id || m.members_id)));
          
          if (id && !memberIds.includes(String(id))) {
            // Only add members who have the correct role (customer or member)
            const memberObj = members.find(mbr => String(mbr.id) === String(id));
            if (memberObj && (memberObj.role === 'customer' || memberObj.role === 'member')) {
              memberIds.push(String(id));
            }
          }
        });
      }
      console.log('Extracted Member IDs:', memberIds);

      setFormData({
        company_name: location.company_name || '',
        company_code: location.company_code || '',
        tax_id: location.tax_id || '',
        phone: location.phone || '',
        email: location.email || '',
        address: location.address || '',
        branch: location.branch || '',
        member_ids: memberIds
      });
    } else {
      setEditingLocation(null);
      setOriginalMembers([]);
      setFormData({
        company_name: '',
        company_code: '',
        tax_id: '',
        phone: '',
        email: '',
        address: '',
        branch: '',
        member_ids: []
      });
    }
    setIsModalOpen(true);
  };

  const handleReset = () => {
    if (editingLocation) {
      handleOpenModal(editingLocation);
    } else {
      handleOpenModal();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    
    setSubmitting(true);
    setActionError(null);
    try {
      const validMemberIds = formData.member_ids.filter(id => id && id !== '');
      console.log('Valid Member IDs for submission:', validMemberIds);
      
      // Determine the best junction field to use
      let currentJunctionField = junctionField;
      if (originalMembers.length > 0) {
        const m = originalMembers[0];
        if (m.line_users_id !== undefined) currentJunctionField = 'line_users_id';
        else if (m.members_id !== undefined) currentJunctionField = 'members_id';
        else if (m.line_user_id !== undefined) currentJunctionField = 'line_user_id';
      }
      console.log('Using junction field for submission:', currentJunctionField);
      
      const payload: any = {
        company_name: formData.company_name,
        company_code: formData.company_code,
        tax_id: formData.tax_id,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        branch: formData.branch,
      };

      if (editingLocation) {
        const currentJunctions = originalMembers || [];
        
        // Identify junction records to delete
        const toDelete = currentJunctions
          .filter(j => {
            const userId = typeof j.line_users_id === 'object' ? j.line_users_id?.id :
                           (typeof j.line_user_id === 'object' ? j.line_user_id?.id : 
                           (typeof j.members_id === 'object' ? j.members_id?.id : (j.line_users_id || j.line_user_id || j.members_id)));
            return userId && !validMemberIds.includes(String(userId));
          })
          .map(j => j.id)
          .filter(id => id !== undefined && id !== null);
        
        // Identify new members to add
        const toCreate = validMemberIds
          .filter(userId => !currentJunctions.some(j => {
            const existingUserId = typeof j.line_users_id === 'object' ? j.line_users_id?.id :
                                   (typeof j.line_user_id === 'object' ? j.line_user_id?.id : 
                                   (typeof j.members_id === 'object' ? j.members_id?.id : (j.line_users_id || j.line_user_id || j.members_id)));
            return existingUserId && String(existingUserId) === String(userId);
          }))
          .map(userId => {
            const idStr = String(userId);
            const id = !isNaN(Number(idStr)) && idStr.trim() !== '' ? Number(idStr) : userId;
            
            const item: any = {};
            item[currentJunctionField] = id;
            return item;
          });

        console.log('M2M Sync:', { toCreate, toDelete });

        // Use explicit create/delete syntax for M2M
        payload.members = {
          create: toCreate,
          delete: toDelete,
          update: []
        };

        // Set member_id as fallback for older parts of the app
        if (validMemberIds.length > 0) {
          const firstId = validMemberIds[0];
          const firstIdStr = String(firstId);
          payload.member_id = !isNaN(Number(firstIdStr)) && firstIdStr.trim() !== '' ? Number(firstIdStr) : firstId;
        }
      } else {
        // For new records, just send the list of junction objects
        if (validMemberIds.length > 0) {
          payload.members = validMemberIds.map(userId => {
            const userIdStr = String(userId);
            const id = !isNaN(Number(userIdStr)) && userIdStr.trim() !== '' ? Number(userIdStr) : userId;
            
            const item: any = {};
            item[currentJunctionField] = id;
            return item;
          });
          
          // Set member_id as fallback
          const firstId = validMemberIds[0];
          const firstIdStr = String(firstId);
          payload.member_id = !isNaN(Number(firstIdStr)) && firstIdStr.trim() !== '' ? Number(firstIdStr) : firstId;
        }
      }

      console.log('Submitting Customer Location Payload:', JSON.stringify(payload, null, 2));

      if (editingLocation) {
        const response = await directusApi.updateCustomerLocation(editingLocation.id, payload);
        console.log('Update Response:', response);
      } else {
        const response = await directusApi.createCustomerLocation(payload);
        console.log('Create Response:', response);
      }
      
      // Show success message
      setActionError(null);
      setIsModalOpen(false);
      setEditingLocation(null);
      setOriginalMembers([]);
      setFormData({
        company_name: '',
        company_code: '',
        tax_id: '',
        phone: '',
        email: '',
        address: '',
        branch: '',
        member_ids: []
      });
      await fetchData();
      window.alert(t('save_success'));
    } catch (err: any) {
      console.error('CRITICAL: Error saving location:', err);
      if (err.response) {
        console.error('Error Response Data:', err.response.data);
      }
      const errorMsg = err.response?.data?.errors?.[0]?.message || err.message || t('save_error');
      setActionError(errorMsg);
      window.alert(`${t('error_occurred')}: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setActionError(null);
      await directusApi.deleteCustomerLocation(deleteId);
      setDeleteId(null);
      fetchData();
    } catch (err: any) {
      console.error('Error deleting location:', err);
      setActionError(err.message || t('error_deleting'));
      setDeleteId(null);
    }
  };

  const filteredLocations = locations.filter(l => {
    const company = (l.company_name || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    
    return company.includes(search);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-900">{t('customer_locations')}</h2>
          {canAddLocation && (
            <button 
              onClick={() => handleOpenModal()}
              className="bg-primary text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-800 transition-colors flex items-center gap-2 shadow-lg shadow-blue-100 whitespace-nowrap"
            >
              <Plus className="w-5 h-5 flex-shrink-0" />
              <span className="hidden sm:inline">{t('add_customer_location')}</span>
              <Plus className="w-5 h-5 sm:hidden" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder={t('search_customers')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <div className="text-sm text-slate-500">
            {t('total_members')}: {filteredLocations.length}
          </div>
        </div>

        {error && (
          <div className="p-6 bg-red-50 border-b border-red-100 text-red-600 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
            <button onClick={fetchData} className="text-xs font-bold underline">{t('try_again')}</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {loading ? (
            <div className="col-span-full py-12 text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-500">{t('loading')}</p>
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400">
              {t('no_data')}
            </div>
          ) : (
            filteredLocations.map((loc) => (
              <LocationCard 
                key={loc.id} 
                loc={loc} 
                members={members} 
                canEdit={canAddLocation} 
                onEdit={handleOpenModal} 
                onDelete={setDeleteId} 
              />
            ))
          )}
        </div>
      </div>

      <ConfirmModal 
        isOpen={!!deleteId}
        title={t('confirm_delete')}
        message={t('confirm_delete_message')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmText={t('delete')}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  {editingLocation ? t('edit_customer_location') : t('add_customer_location')}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8">
              {actionError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 flex items-center gap-3 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {actionError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Basic Info */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">{t('company_name')}</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="text" 
                          required
                          value={formData.company_name}
                          onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                          placeholder={t('company_name')}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">{t('company_code')}</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="text" 
                          value={formData.company_code}
                          onChange={(e) => setFormData({...formData, company_code: e.target.value})}
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                          placeholder={t('company_code_placeholder')}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">{t('tax_id')}</label>
                      <input 
                        type="text" 
                        value={formData.tax_id}
                        onChange={(e) => setFormData({...formData, tax_id: e.target.value})}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                        placeholder={t('tax_id')}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">{t('branch')}</label>
                      <input 
                        type="text" 
                        value={formData.branch}
                        onChange={(e) => setFormData({...formData, branch: e.target.value})}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                        placeholder={t('branch')}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">{t('phone')}</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                        placeholder={t('phone')}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">{t('email')}</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="email" 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                        placeholder={t('email')}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">{t('address')}</label>
                    <div className="relative">
                      <Map className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <textarea 
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary min-h-[100px] transition-all resize-none"
                        placeholder={t('address')}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Contact Person Group */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        {t('contact_person')} ({formData.member_ids.length})
                      </label>
                      <button 
                        type="button"
                        onClick={() => navigate('/members')}
                        className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        {t('add_member')}
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-500 bg-blue-50 p-2 rounded-lg border border-blue-100">
                      * {t('member_notification_desc')}
                    </p>

                    {/* Member Selection Area */}
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="text"
                          placeholder={t('search_members_placeholder')}
                          value={memberSearchTerm}
                          onChange={(e) => setMemberSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                        />
                      </div>

                      <DndContext
                        sensors={sensors}
                        collisionDetection={rectIntersection}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="flex flex-col gap-4">
                          <DroppableContainer
                            id="available-container"
                            title={t('available_members')}
                            icon={User}
                            items={availableMembers}
                            onAdd={handleAddMember}
                            emptyText={t('no_available_members')}
                          />
                          
                          <div className="flex items-center justify-center gap-4 text-slate-300 py-2">
                            <div className="h-px flex-1 bg-slate-100"></div>
                            <div className="flex flex-col items-center">
                              <ArrowRight className="w-4 h-4 rotate-90 md:rotate-0" />
                              <ArrowLeft className="w-4 h-4 rotate-90 md:rotate-0" />
                            </div>
                            <div className="h-px flex-1 bg-slate-100"></div>
                          </div>

                          <DroppableContainer
                            id="selected-container"
                            title={t('selected_members')}
                            icon={CheckCircle2}
                            items={selectedMembersList}
                            onRemove={handleRemoveMember}
                            emptyText={t('drag_members_here')}
                          />
                        </div>

                        <DragOverlay dropAnimation={{
                          sideEffects: defaultDropAnimationSideEffects({
                            styles: {
                              active: {
                                opacity: '0.5',
                              },
                            },
                          }),
                        }}>
                          {activeId ? (() => {
                            const activeMember = members.find(m => String(m.id) === String(activeId));
                            if (!activeMember) return null;
                            return (
                              <SortableMember 
                                member={activeMember} 
                                isOverlay 
                              />
                            );
                          })() : null}
                        </DragOverlay>
                      </DndContext>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="button"
                  onClick={handleReset}
                  className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  {t('reset')}
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="px-10 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-100 disabled:opacity-70 flex items-center justify-center min-w-[140px]"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingLocation ? t('save_changes') : t('add_customer_location'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
