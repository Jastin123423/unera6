
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { User, Brand, Post as PostType, Event, LinkPreview, AudioTrack } from '../types';
import { Post, CreatePostModal } from './Feed';
import { BRAND_CATEGORIES, LOCATIONS_DATA } from '../constants';
import { CreateEventModal } from './Events';

// --- CREATE BRAND MODAL ---
interface CreateBrandModalProps {
    currentUser: User;
    onClose: () => void;
    onCreate: (brand: Partial<Brand>) => void;
}

const CreateBrandModal: React.FC<CreateBrandModalProps> = ({ currentUser, onClose, onCreate }) => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [website, setWebsite] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    
    const handleSubmit = () => {
        if (!name.trim() || !category || !location) return;
        onCreate({
            name,
            category,
            description,
            website,
            location,
            contact_email: contactEmail,
            contact_phone: contactPhone,
            admin_id: currentUser.id,
            profile_image_url: `https://ui-avatars.com/api/?name=${name.replace(/\s/g, '+')}&background=random`,
            cover_image_url: 'https://images.unsplash.com/photo-1557683316-973673baf926?ixlib=rb-1.2.1&auto=format&fit=crop&w=1500&q=80',
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4 animate-fade-in font-sans">
            <div className="bg-[#242526] w-full max-w-[500px] rounded-xl border border-[#3E4042] shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-[#3E4042] flex justify-between items-center">
                    <h3 className="text-xl font-bold text-[#E4E6EB]">{step === 1 ? 'Create a Page' : 'Contact Info'}</h3>
                    <div onClick={onClose} className="w-8 h-8 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] flex items-center justify-center cursor-pointer">
                        <i className="fas fa-times text-[#B0B3B8]"></i>
                    </div>
                </div>
                
                <div className="p-4 overflow-y-auto space-y-4">
                    {step === 1 ? (
                        <>
                            <div>
                                <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Page Name <span className="text-red-500">*</span></label>
                                <input type="text" className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]" placeholder="Business or Brand Name" value={name} onChange={e => setName(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Category <span className="text-red-500">*</span></label>
                                <select className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]" value={category} onChange={e => setCategory(e.target.value)}>
                                    <option value="">Select a Category</option>
                                    {BRAND_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Description</label>
                                <textarea className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2] resize-none h-24" placeholder="Describe your brand..." value={description} onChange={e => setDescription(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Location (Country/Region) <span className="text-red-500">*</span></label>
                                <input type="text" list="locations" className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]" placeholder="e.g. Dar es Salaam, Tanzania" value={location} onChange={e => setLocation(e.target.value)} />
                                <datalist id="locations">
                                    {LOCATIONS_DATA.map(l => <option key={l.name} value={l.name} />)}
                                </datalist>
                            </div>
                            <button onClick={() => setStep(2)} disabled={!name.trim() || !category || !location} className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50">Next</button>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-[#B0B3B8] mb-2">Add contact details to help people reach you (Optional).</p>
                            <div>
                                <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Website</label>
                                <input type="text" className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]" placeholder="https://example.com" value={website} onChange={e => setWebsite(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Business Email</label>
                                <input type="email" className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]" placeholder="contact@brand.com" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Business Phone</label>
                                <input type="tel" className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]" placeholder="+255..." value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setStep(1)} className="flex-1 bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] py-2.5 rounded-lg font-bold transition-colors">Back</button>
                                <button onClick={handleSubmit} className="flex-1 bg-[#42B72A] hover:bg-[#36A420] text-white py-2.5 rounded-lg font-bold transition-colors">Create Page</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- EDIT BRAND MODAL ---
interface EditBrandModalProps {
    brand: Brand;
    onClose: () => void;
    onUpdate: (updatedData: Partial<Brand>) => void;
}

const EditBrandModal: React.FC<EditBrandModalProps> = ({ brand, onClose, onUpdate }) => {
    const [description, setDescription] = useState(brand.description || '');
    const [website, setWebsite] = useState(brand.website || '');
    const [location, setLocation] = useState(brand.location || '');
    const [contactEmail, setContactEmail] = useState(brand.contact_email || '');
    const [contactPhone, setContactPhone] = useState(brand.contact_phone || '');

    const handleSave = () => {
        onUpdate({ description, website, location, contact_email: contactEmail, contact_phone: contactPhone });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4 animate-fade-in font-sans">
            <div className="bg-[#242526] w-full max-w-[600px] rounded-xl border border-[#3E4042] shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-[#3E4042] flex justify-between items-center">
                    <h2 className="text-xl font-bold text-[#E4E6EB]">Edit Page Info</h2>
                    <div onClick={onClose} className="w-8 h-8 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] flex items-center justify-center cursor-pointer">
                        <i className="fas fa-times text-[#B0B3B8]"></i>
                    </div>
                </div>
                <div className="p-4 overflow-y-auto space-y-4">
                    <div>
                        <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Description</label>
                        <textarea className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none h-24 resize-none" value={description} onChange={e => setDescription(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Location</label>
                        <input type="text" className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none" value={location} onChange={e => setLocation(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Website</label>
                        <input type="text" className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none" value={website} onChange={e => setWebsite(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Contact Email</label>
                        <input type="email" className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Contact Phone</label>
                        <input type="tel" className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none" value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
                    </div>
                    <button onClick={handleSave} className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white py-2.5 rounded-lg font-bold transition-colors">Save Changes</button>
                </div>
            </div>
        </div>
    );
};

// --- BRANDS PAGE COMPONENT ---
interface BrandsPageProps {
    currentUser: User | null;
    brands: Brand[];
    posts: PostType[];
    users: User[]; 
    onCreateBrand: (brand: Partial<Brand>) => void;
    onFollowBrand: (brandId: number) => void;
    onProfileClick: (id: number) => void;
    onPostAsBrand: (brandId: number, content: any) => void;
    onReact: (postId: number, type: any) => void;
    onShare: (postId: number) => void;
    onOpenComments: (postId: number) => void;
    onUpdateBrand?: (brandId: number, data: Partial<Brand>) => void;
    onDeleteBrand: (brandId: number) => void;
    onMessage?: (brandId: number) => void;
    onCreateEvent?: (brandId: number, event: Partial<Event>) => void;
    initialBrandId?: number | null;
    onPlayAudioTrack?: (track: AudioTrack) => void;
}

export const BrandsPage: React.FC<BrandsPageProps> = ({ 
    currentUser, brands, posts, users, onCreateBrand, onFollowBrand, 
    onProfileClick, onPostAsBrand, onReact, onShare, onOpenComments,
    onUpdateBrand, onDeleteBrand, onMessage, onCreateEvent, initialBrandId, onPlayAudioTrack
}) => {
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [activeBrandId, setActiveBrandId] = useState<number | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCreatePostModal, setShowCreatePostModal] = useState(false);
    const [showEditBrandModal, setShowEditBrandModal] = useState(false);
    const [showCreateEventModal, setShowCreateEventModal] = useState(false);
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const [activeTab, setActiveTab] = useState<'Posts' | 'About' | 'Photos'>('Posts');
    const [searchQuery, setSearchQuery] = useState('');

    const profileInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialBrandId) {
            const brand = brands.find(b => b.id === initialBrandId);
            if (brand) {
                setActiveBrandId(brand.id);
                setView('detail');
                setActiveTab('Posts');
            }
        } else {
            setView('list');
            setActiveBrandId(null);
        }
    }, [initialBrandId, brands]);

    const activeBrand = useMemo(() => brands.find(b => b.id === activeBrandId), [brands, activeBrandId]);
    const isOwner = currentUser && activeBrand && activeBrand.admin_id === currentUser.id;
    const isPlatformAdmin = currentUser?.role === 'admin';
    const canManage = isOwner || isPlatformAdmin;
    const isFollowing = currentUser && activeBrand && activeBrand.followers.includes(currentUser.id);

    const brandPosts = useMemo(() => {
        if (!activeBrand) return [];
        return posts.filter(p => p.brand_id === activeBrand.id).sort((a,b) => (new Date(b.created_at).getTime() || 0) - (new Date(a.created_at).getTime() || 0));
    }, [posts, activeBrand]);

    const handleBrandClick = (brandId: number) => {
        setActiveBrandId(brandId);
        setView('detail');
        setActiveTab('Posts');
        window.scrollTo(0, 0);
    };

    const handleCreatePost = (text: string, file: File | null, type: any, visibility: any, location?: string, feeling?: string, taggedUsers?: number[], background?: string, linkPreview?: LinkPreview) => {
        if (!activeBrand) return;
        onPostAsBrand(activeBrand.id, { text, file, type, visibility, location, feeling, taggedUsers, background, linkPreview });
        setShowCreatePostModal(false);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'profile') => {
        if (e.target.files && e.target.files[0] && activeBrand && onUpdateBrand) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            onUpdateBrand(activeBrand.id, type === 'cover' ? { cover_image_url: url } : { profile_image_url: url });
        }
    };

    if (view === 'list' || !activeBrand) {
        const myBrands = currentUser ? brands.filter(b => b.admin_id === currentUser.id) : [];
        let otherBrands = currentUser ? brands.filter(b => b.admin_id !== currentUser.id) : brands;

        if (searchQuery.trim()) {
            otherBrands = otherBrands.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return (
            <div className="w-full max-w-[1000px] mx-auto p-4 font-sans pb-20">
                <div className="flex flex-col gap-4 mb-6 bg-[#242526] p-4 rounded-xl border border-[#3E4042]">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-[#E4E6EB]">Brands & Pages</h2>
                            <p className="text-[#B0B3B8] text-sm">Discover businesses and creators.</p>
                        </div>
                        {currentUser && (
                            <button onClick={() => setShowCreateModal(true)} className="bg-[#263951] text-[#F3425F] hover:bg-[#2A3F5A] px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors">
                                <i className="fas fa-briefcase text-lg"></i> <span>Create Brand</span>
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <input 
                            type="text" 
                            className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 pl-10 text-[#E4E6EB] outline-none focus:border-[#1877F2]" 
                            placeholder="Search Brands..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B3B8]"></i>
                    </div>
                </div>

                {myBrands.length > 0 && !searchQuery && (
                    <div className="mb-8">
                        <h3 className="text-xl font-bold text-[#E4E6EB] mb-3">Pages You Manage</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {myBrands.map(brand => (
                                <div key={brand.id} className="bg-[#242526] rounded-xl overflow-hidden border border-[#3E4042] cursor-pointer hover:shadow-lg transition-all flex flex-col" onClick={() => handleBrandClick(brand.id)}>
                                    <div className="h-32 bg-gray-700 relative">
                                        <img src={brand.cover_image_url} className="w-full h-full object-cover" alt="" />
                                    </div>
                                    <div className="p-4 pt-10 relative">
                                        <div className="absolute -top-8 left-4 rounded-full border-4 border-[#242526] overflow-hidden w-16 h-16 bg-[#3A3B3C]">
                                            <img src={brand.profile_image_url} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <h4 className="font-bold text-lg text-[#E4E6EB]">{brand.name}</h4>
                                        <p className="text-[#B0B3B8] text-xs">{brand.category} • {brand.followers.length} followers</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <h3 className="text-xl font-bold text-[#E4E6EB] mb-3">{searchQuery ? 'Search Results' : 'Suggested Pages'}</h3>
                    {otherBrands.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {otherBrands.map(brand => (
                                <div key={brand.id} className="bg-[#242526] rounded-xl overflow-hidden border border-[#3E4042] flex flex-col">
                                    <div className="h-32 relative cursor-pointer" onClick={() => handleBrandClick(brand.id)}>
                                        <img src={brand.cover_image_url} className="w-full h-full object-cover" alt="" />
                                    </div>
                                    <div className="p-4 flex flex-col flex-1 relative">
                                        <div className="absolute -top-8 left-4 rounded-full border-4 border-[#242526] overflow-hidden w-16 h-16 bg-[#3A3B3C] cursor-pointer" onClick={() => handleBrandClick(brand.id)}>
                                            <img src={brand.profile_image_url} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div className="mt-8">
                                            <h4 className="font-bold text-lg text-[#E4E6EB] hover:underline cursor-pointer" onClick={() => handleBrandClick(brand.id)}>{brand.name} {brand.is_verified && <i className="fas fa-check-circle text-[#1877F2] text-sm"></i>}</h4>
                                            <p className="text-[#B0B3B8] text-xs mb-1">{brand.category}</p>
                                            <p className="text-[#B0B3B8] text-sm line-clamp-2 mb-4">{brand.description}</p>
                                            <button onClick={() => currentUser ? onFollowBrand(brand.id) : alert("Login to follow")} className="w-full bg-[#263951] text-[#F3425F] hover:bg-[#2A3F5A] font-bold py-2 rounded-lg transition-colors">
                                                {currentUser && brand.followers.includes(currentUser.id) ? 'Following' : 'Follow'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[#B0B3B8]">No brands found.</p>
                    )}
                </div>

                {showCreateModal && currentUser && (
                    <CreateBrandModal currentUser={currentUser} onClose={() => setShowCreateModal(false)} onCreate={onCreateBrand} />
                )}
            </div>
        );
    }

    return (
        <div className="w-full bg-[#18191A] min-h-screen pb-10 font-sans">
            <input type="file" ref={profileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, 'profile')} />
            <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, 'cover')} />

            <div className="bg-[#242526] border-b border-[#3E4042] shadow-sm mb-4">
                <div className="max-w-[1100px] mx-auto">
                    <div className="h-[200px] md:h-[350px] relative group bg-[#3A3B3C]">
                        <img src={activeBrand.cover_image_url} className="w-full h-full object-cover md:rounded-b-xl" alt="Cover" />
                        {canManage && (
                            <div className="absolute bottom-4 right-4 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg cursor-pointer hover:bg-white/20 font-bold text-white text-sm flex items-center gap-2" onClick={() => coverInputRef.current?.click()}>
                                <i className="fas fa-camera"></i> Edit Cover
                            </div>
                        )}
                    </div>
                    <div className="px-4 pb-0">
                        <div className="flex flex-col md:flex-row items-start md:items-end -mt-[40px] md:-mt-[30px] relative z-10 gap-4 mb-4">
                            <div className="relative group">
                                <div className="w-[100px] h-[100px] md:w-[140px] md:h-[140px] rounded-full border-4 border-[#242526] overflow-hidden bg-[#242526]">
                                    <img src={activeBrand.profile_image_url} className="w-full h-full object-cover" alt="" />
                                </div>
                                {canManage && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => profileInputRef.current?.click()}>
                                        <i className="fas fa-camera text-white text-2xl"></i>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex-1 mt-2">
                                <h1 className="text-2xl md:text-3xl font-bold text-[#E4E6EB] leading-tight mb-1 flex items-center gap-2">
                                    {activeBrand.name} 
                                    {activeBrand.is_verified && <i className="fas fa-check-circle text-[#1877F2] text-[20px]"></i>}
                                </h1>
                                <p className="text-[#B0B3B8] font-semibold text-[15px]">{activeBrand.category} • {activeBrand.location} • {activeBrand.followers.length} followers</p>
                            </div>

                            <div className="flex gap-2 mt-4 md:mt-0 w-full md:w-auto relative">
                                {canManage ? (
                                    <>
                                        <button onClick={() => setShowCreateEventModal(true)} className="bg-[#3A3B3C] text-[#E4E6EB] px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#4E4F50] flex-1 md:flex-none">
                                            <i className="fas fa-plus"></i> Event
                                        </button>
                                        <button onClick={() => setShowEditBrandModal(true)} className="bg-[#3A3B3C] text-[#E4E6EB] px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#4E4F50] flex-1 md:flex-none">
                                            <i className="fas fa-pen"></i> Edit Page
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => currentUser ? onFollowBrand(activeBrand.id) : alert("Login to follow")} className={`${isFollowing ? 'bg-[#3A3B3C] text-[#E4E6EB]' : 'bg-[#1877F2] text-white'} px-6 py-2 rounded-lg font-bold text-base hover:opacity-90 flex-1 md:flex-none transition-colors`}>
                                            {isFollowing ? 'Following' : 'Follow'}
                                        </button>
                                        <button onClick={() => onMessage && onMessage(activeBrand.id)} className="bg-[#3A3B3C] text-[#E4E6EB] px-4 py-2 rounded-lg font-bold text-base hover:bg-[#4E4F50] flex-1 md:flex-none">
                                            <i className="fab fa-facebook-messenger mr-1"></i> Message
                                        </button>
                                        {activeBrand.contact_phone && (
                                            <a href={`tel:${activeBrand.contact_phone}`} className="bg-[#25D366] text-white px-4 py-2 rounded-lg font-bold text-base hover:bg-[#20bd5a] flex items-center justify-center gap-2 flex-1 md:flex-none no-underline">
                                                <i className="fab fa-whatsapp"></i> WhatsApp
                                            </a>
                                        )}
                                    </>
                                )}
                                <button onClick={() => setShowOptionsMenu(!showOptionsMenu)} className="bg-[#3A3B3C] text-[#E4E6EB] px-3 py-2 rounded-lg font-bold hover:bg-[#4E4F50] transition-colors">
                                    <i className="fas fa-ellipsis-h"></i>
                                </button>
                                {showOptionsMenu && isPlatformAdmin && (
                                    <div className="absolute top-full right-0 mt-2 w-48 bg-[#242526] border border-[#3E4042] rounded-lg shadow-xl z-20 py-1">
                                         <div onClick={() => { onDeleteBrand(activeBrand.id); setShowOptionsMenu(false); }} className="px-4 py-2 hover:bg-[#3A3B3C] text-red-500 cursor-pointer flex items-center gap-2"><i className="fas fa-trash-alt"></i> Delete Page</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-[#3E4042] mt-4"></div>
                        <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                            {['Posts', 'About', 'Photos'].map(tab => (
                                <div key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-3 cursor-pointer font-semibold text-base border-b-[3px] transition-colors whitespace-nowrap ${activeTab === tab ? 'text-[#1877F2] border-[#1877F2]' : 'text-[#B0B3B8] border-transparent hover:bg-[#3A3B3C] rounded-t-lg'}`}>{tab}</div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1000px] mx-auto w-full flex flex-col md:flex-row gap-4 px-0 md:px-4">
                <div className="w-full md:w-[360px] flex-shrink-0 flex flex-col gap-4 px-4 md:px-0">
                    <div className="bg-[#242526] rounded-xl p-4 shadow-sm border border-[#3E4042]">
                        <h2 className="text-xl font-bold text-[#E4E6EB] mb-4">About</h2>
                        <div className="flex flex-col gap-3 text-[#E4E6EB] text-[15px]">
                            <p>{activeBrand.description}</p>
                            <div className="h-[1px] bg-[#3E4042] w-full my-2"></div>
                            <div className="flex items-center gap-3 text-[#B0B3B8]"><i className="fas fa-info-circle w-5 text-center"></i><span>{activeBrand.category}</span></div>
                            <div className="flex items-center gap-3 text-[#B0B3B8]"><i className="fas fa-map-marker-alt w-5 text-center"></i><span>{activeBrand.location || 'Location not added'}</span></div>
                            {activeBrand.website && <div className="flex items-center gap-3 text-[#B0B3B8]"><i className="fas fa-globe w-5 text-center"></i><a href={activeBrand.website.startsWith('http') ? activeBrand.website : `https://${activeBrand.website}`} target="_blank" rel="noreferrer" className="text-[#1877F2] hover:underline truncate">{activeBrand.website}</a></div>}
                            {activeBrand.contact_email && <div className="flex items-center gap-3 text-[#B0B3B8]"><i className="fas fa-envelope w-5 text-center"></i><span>{activeBrand.contact_email}</span></div>}
                            {canManage && <button className="w-full bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] font-semibold py-2 rounded-md transition-colors text-sm mt-2" onClick={() => setShowEditBrandModal(true)}>Edit Details</button>}
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    {activeTab === 'Posts' && (
                        <>
                            {canManage && currentUser && (
                                <>
                                    <div className="bg-[#242526] rounded-xl p-3 md:p-4 mb-4 shadow-sm border border-[#3E4042]">
                                        <div className="flex gap-2 mb-3">
                                            <img src={activeBrand.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover cursor-pointer border border-[#3E4042]" />
                                            <div className="flex-1 bg-[#3A3B3C] rounded-full px-3 md:px-4 py-2 hover:bg-[#4E4F50] cursor-pointer flex items-center transition-colors" onClick={() => setShowCreatePostModal(true)}>
                                                <span className="text-[#B0B3B8] text-[17px] truncate">What new brand idea Today?</span>
                                            </div>
                                        </div>
                                        <div className="border-t border-[#3E4042] pt-2 flex justify-between">
                                            <div className="flex items-center justify-center flex-1 gap-2 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors" onClick={() => setShowCreatePostModal(true)}>
                                                <i className="fas fa-video text-[#F3425F] text-[24px]"></i>
                                                <span className="text-[#B0B3B8] font-semibold text-[15px] hidden sm:block">Live Video</span>
                                            </div>
                                            <div className="flex items-center justify-center flex-1 gap-2 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors" onClick={() => setShowCreatePostModal(true)}>
                                                <i className="fas fa-images text-[#45BD62] text-[24px]"></i>
                                                <span className="text-[#B0B3B8] font-semibold text-[15px] hidden sm:block">Photo/Video</span>
                                            </div>
                                            <div className="flex items-center justify-center flex-1 gap-2 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors" onClick={() => setShowCreateEventModal(true)}>
                                                <i className="fas fa-calendar-plus text-[#F7B928] text-[24px]"></i>
                                                <span className="text-[#B0B3B8] font-semibold text-[15px] hidden sm:block">Event</span>
                                            </div>
                                        </div>
                                    </div>

                                    {showCreatePostModal && (
                                        <CreatePostModal 
                                            currentUser={{...currentUser, name: activeBrand.name, profile_image_url: activeBrand.profile_image_url} as User} 
                                            users={users} 
                                            onClose={() => setShowCreatePostModal(false)}
                                            onCreatePost={handleCreatePost}
                                        />
                                    )}
                                </>
                            )}
                            <div className="space-y-4">
                                {brandPosts.length > 0 ? brandPosts.map(post => (
                                    <Post 
                                        key={post.id}
                                        post={post}
                                        author={activeBrand as any} 
                                        currentUser={currentUser}
                                        users={users} 
                                        onProfileClick={onProfileClick}
                                        onReact={onReact}
                                        onShare={onShare}
                                        onOpenComments={onOpenComments}
                                        onVideoClick={() => {}}
                                        onViewImage={() => {}}
                                        onPlayAudioTrack={onPlayAudioTrack}
                                    />
                                )) : (
                                    <div className="bg-[#242526] rounded-xl p-8 text-center border border-[#3E4042] mx-4 md:mx-0">
                                        <p className="text-[#B0B3B8]">No posts yet.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    {activeTab === 'Photos' && (
                        <div className="bg-[#242526] rounded-xl p-4 border border-[#3E4042] mx-4 md:mx-0">
                            <h2 className="text-xl font-bold text-[#E4E6EB] mb-4">Photos</h2>
                            <div className="grid grid-cols-3 gap-1">
                                {brandPosts.filter(p => p.type === 'image' && p.media_url).map(p => (
                                    <img key={p.id} src={p.media_url} className="aspect-square object-cover w-full cursor-pointer hover:opacity-90" alt="" />
                                ))}
                            </div>
                            {brandPosts.filter(p => p.type === 'image').length === 0 && <p className="text-[#B0B3B8]">No photos available.</p>}
                        </div>
                    )}
                </div>
            </div>

            {showEditBrandModal && activeBrand && (
                <EditBrandModal 
                    brand={activeBrand} 
                    onClose={() => setShowEditBrandModal(false)} 
                    onUpdate={(data) => onUpdateBrand && onUpdateBrand(activeBrand.id, data)} 
                />
            )}

            {showCreateEventModal && currentUser && onCreateEvent && (
                <CreateEventModal 
                    currentUser={currentUser}
                    onClose={() => setShowCreateEventModal(false)}
                    onCreate={(e) => onCreateEvent(activeBrand.id, e)}
                />
            )}
        </div>
    );
};
