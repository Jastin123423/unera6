
import { User, Post, Story, Reel, LocationData, Event, Group, Song, Album, Podcast, Episode, Brand, Reaction } from './types';

// Comprehensive List of Locations with Flags (Focus on World + Africa)
export const LOCATIONS_DATA: LocationData[] = [
    { name: "Arusha, Tanzania", flag: "🇹🇿" },
    { name: "Dar es Salaam, Tanzania", flag: "🇹🇿" },
    { name: "Dodoma, Tanzania", flag: "🇹🇿" },
    { name: "Zanzibar, Tanzania", flag: "🇹🇿" },
    { name: "Mwanza, Tanzania", flag: "🇹🇿" },
    { name: "Mbeya, Tanzania", flag: "🇹🇿" },
    { name: "Nairobi, Kenya", flag: "🇰🇪" },
    { name: "Mombasa, Kenya", flag: "🇰🇪" },
    { name: "Kampala, Uganda", flag: "🇺🇬" },
    { name: "Kigali, Rwanda", flag: "🇷🇼" },
    { name: "Lagos, Nigeria", flag: "🇳🇬" },
    { name: "Abuja, Nigeria", flag: "🇳🇬" },
    { name: "Accra, Ghana", flag: "🇬🇭" },
    { name: "Johannesburg, South Africa", flag: "🇿🇦" },
    { name: "Cape Town, South Africa", flag: "🇿🇦" },
    { name: "Cairo, Egypt", flag: "🇪🇬" },
    { name: "Addis Ababa, Ethiopia", flag: "🇪🇹" },
    { name: "London, United Kingdom", flag: "🇬🇧" },
    { name: "New York, USA", flag: "🇺🇸" },
    { name: "Los Angeles, USA", flag: "🇺🇸" },
    { name: "Paris, France", flag: "🇫🇷" },
    { name: "Berlin, Germany", flag: "🇩🇪" },
    { name: "Tokyo, Japan", flag: "🇯🇵" },
    { name: "Dubai, UAE", flag: "🇦🇪" },
    { name: "Beijing, China", flag: "🇨🇳" },
    { name: "Sydney, Australia", flag: "🇦🇺" },
    { name: "Toronto, Canada", flag: "🇨🇦" },
    { name: "Mumbai, India", flag: "🇮🇳" },
    { name: "New Delhi, India", flag: "🇮🇳" },
    { name: "Rio de Janeiro, Brazil", flag: "🇧🇷" },
    { name: "Moscow, Russia", flag: "🇷🇺" },
    { name: "Kinshasa, DRC", flag: "🇨🇩" },
    { name: "Luanda, Angola", flag: "🇦🇴" },
    { name: "Maputo, Mozambique", flag: "🇲🇿" },
    { name: "Lusaka, Zambia", flag: "🇿🇲" },
    { name: "Harare, Zimbabwe", flag: "🇿🇼" },
];

export const COUNTRIES = LOCATIONS_DATA.map(l => l.name);

export const MARKETPLACE_CATEGORIES = [
    { id: 'all', name: 'All Products' },
    { id: 'electronics', name: 'Electronics' },
    { id: 'books', name: 'Books' },
    { id: 'services', name: 'Services' },
    { id: 'real_estate', name: 'Real Estate' },
    { id: 'vehicles', name: 'Vehicles' },
    { id: 'furniture', name: 'Furniture' },
    { id: 'clothing', name: 'Clothing' },
    { id: 'sports', name: 'Sports & Fitness' },
    { id: 'home_garden', name: 'Home & Garden' },
    { id: 'business', name: 'Business & Industrial' }
];

export const BRAND_CATEGORIES = [
    'Business', 'Personal Blog', 'Product/Service', 'Art', 'Musician/Band', 'Shopping & Retail', 'Health/Beauty', 'Technology Company', 'Local Business', 'Education'
];

export const MARKETPLACE_COUNTRIES = [
    { code: "all", name: "All Countries", currency: "", symbol: "", flag: "🌍" },
    { code: "TZ", name: "Tanzania", currency: "TZS", symbol: "TSh", flag: "🇹🇿" },
    { code: "KE", name: "Kenya", currency: "KES", symbol: "KSh", flag: "🇰🇪" },
    { code: "UG", name: "Uganda", currency: "UGX", symbol: "USh", flag: "🇺🇬" },
    { code: "NG", name: "Nigeria", currency: "NGN", symbol: "₦", flag: "🇳🇬" },
    { code: "ZA", name: "South Africa", currency: "ZAR", symbol: "R", flag: "🇿🇦" },
    { code: "ET", name: "Ethiopia", currency: "ETB", symbol: "Br", flag: "🇪🇹" },
    { code: "EG", name: "Egypt", currency: "EGP", symbol: "E£", flag: "🇪🇬" },
    { code: "GH", name: "Ghana", currency: "GHS", symbol: "GH₵", flag: "🇬🇭" },
    { code: "US", name: "United States", currency: "USD", symbol: "$", flag: "🇺🇸" },
    { code: "GB", name: "United Kingdom", currency: "GBP", symbol: "£", flag: "🇬🇧" },
    { code: "CN", name: "China", currency: "CNY", symbol: "¥", flag: "🇨🇳" },
    { code: "IN", name: "India", currency: "INR", symbol: "₹", flag: "🇮🇳" },
    { code: "AE", name: "UAE", currency: "AED", symbol: "AED", flag: "🇦🇪" }
];

export const REACTION_ICONS: Record<string, string> = {
    like: "👍",
    love: "❤️",
    haha: "😆",
    wow: "😮",
    sad: "😢",
    angry: "😡"
};

export const REACTION_COLORS: Record<string, string> = {
    like: "#1877F2",
    love: "#F3425F",
    haha: "#F7B928",
    wow: "#F7B928",
    sad: "#F7B928",
    angry: "#E41E3F"
};

const stickerBase = [
    "https://media.giphy.com/media/l41Fj8afUOMY8vQc/giphy.gif",
    "https://media.giphy.com/media/10UeedrT5MIfPG/giphy.gif",
    "https://media.giphy.com/media/Wj7lNjMNDxSmc/giphy.gif",
    "https://media.giphy.com/media/26uf9MHun4QN24TEQ/giphy.gif",
    "https://media.giphy.com/media/13CoXDiaCcCoyk/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXp1ZnAzcHg2bXp1ZnAzcHg2bXp1ZnAzcHg2JmVwPXYxX2dpZnNfdHJlbmRpbmcmY3Q9Zw/3o7TKSjRrfIPjeiVyM/giphy.gif",
    "https://media.giphy.com/media/l0HlHFRbmaZtBRhXG/giphy.gif",
    "https://media.giphy.com/media/3o7TKr3nzbh5WgCFxe/giphy.gif",
    "https://media.giphy.com/media/xT0xezQGU5xTFrJMA8/giphy.gif",
    "https://media.giphy.com/media/l0HlCqV35hdEg2GMU/giphy.gif",
    "https://media.giphy.com/media/l2JdZOq7j6H0hQ1i0/giphy.gif",
    "https://media.giphy.com/media/3o7TKDkDbIDJieo1sk/giphy.gif",
    "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
    "https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.gif",
    "https://media.giphy.com/media/l41Yh18f5TDiOKi0o/giphy.gif",
    "https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif"
];

const generateStickers = (count: number) => {
    return Array.from({ length: count }).map((_, i) => stickerBase[i % stickerBase.length]);
};

export const STICKER_PACKS = {
    "All": generateStickers(30),
    "Happy": generateStickers(20),
    "Love": generateStickers(20),
    "Sad": generateStickers(15),
    "Celebration": generateStickers(15),
    "Angry": generateStickers(15),
    "Animals": generateStickers(25),
    "Funny": generateStickers(20)
};

export const EMOJI_LIST = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "☺️", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", 
    "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕",
    "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰",
    "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤",
    "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👺", "🤡", "💩", "👻", "💀",
    "👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘", "👌", "🤌", "🤏", "👉", "👇", "☝️", "✋", "🤚", "🖐️",
    "🖖", "👋", "🤙", "💪", "🦾", "🖕", "✍️", "🙏", "🦶", "🦵", "🦿", "💄", "💋", "👄", "🦷", "👅", "👂", "🦻", "👃", "👣", "👁️",
    "👀", "🧠", "🫀", "🫁", "🦴", "👤", "👥", "🗣️", "🫂"
];

const generateGifs = (category: string, count: number) => {
    const bases = [
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXp1ZnAzcHg2bXp1ZnAzcHg2bXp1ZnAzcHg2JmVwPXYxX2dpZnNfdHJlbmRpbmcmY3Q9Zw/3o7TKSjRrfIPjeiVyM/giphy.gif",
        "https://media.giphy.com/media/l0HlHFRbmaZtBRhXG/giphy.gif",
        "https://media.giphy.com/media/3o7TKr3nzbh5WgCFxe/giphy.gif",
        "https://media.giphy.com/media/xT0xezQGU5xTFrJMA8/giphy.gif",
        "https://media.giphy.com/media/l0HlCqV35hdEg2GMU/giphy.gif",
        "https://media.giphy.com/media/l2JdZOq7j6H0hQ1i0/giphy.gif",
        "https://media.giphy.com/media/3o7TKDkDbIDJieo1sk/giphy.gif",
        "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
        "https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.gif",
        "https://media.giphy.com/media/l41Yh18f5TDiOKi0o/giphy.gif",
        "https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif", 
        "https://media.giphy.com/media/l0HlO3BJ8LALPW4sE/giphy.gif",
        "https://media.giphy.com/media/3o6Zt6ML6JmbCr3jzi/giphy.gif",
        "https://media.giphy.com/media/l0MYxVgD9EL1A3E1W/giphy.gif",
        "https://media.giphy.com/media/l2QDM9Jnim1YVILXa/giphy.gif",
        "https://media.giphy.com/media/3o6fJ1BM7R2EBRDnxK/giphy.gif",
        "https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif",
        "https://media.giphy.com/media/l0MYyDa8S9ghzJhWx/giphy.gif",
        "https://media.giphy.com/media/3o7TKNcbfKa8f2ZYYM/giphy.gif",
        "https://media.giphy.com/media/d2lcHJTG5TSCnT0I/giphy.gif",
        "https://media.giphy.com/media/7SF5scGB2AFrgsXP63/giphy.gif",
        "https://media.giphy.com/media/l0HlI1EyB8BVEHpDy/giphy.gif",
        "https://media.giphy.com/media/3o6wrvdHFbwBrUFenu/giphy.gif",
        "https://media.giphy.com/media/OPU6wzx8JrHna/giphy.gif",
        "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif",
        "https://media.giphy.com/media/BzyTuYCmvSORqs1ABM/giphy.gif",
        "https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif",
        "https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif",
        "https://media.giphy.com/media/13CoXDiaCcCoyk/giphy.gif",
        "https://media.giphy.com/media/l0ExkEkBl7x2UjWGS/giphy.gif",
        "https://media.giphy.com/media/3o7TKrEzvJbsTEKHUh/giphy.gif",
        "https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif",
        "https://media.giphy.com/media/3o6ZtaO9BZHcOjmEyn/giphy.gif",
        "https://media.giphy.com/media/l2Jhtq2aG5cQZ40hy/giphy.gif"
    ];
    return Array.from({ length: count }).map((_, i) => bases[i % bases.length]);
};

export const GIF_CATEGORIES = {
    "Trending": generateGifs("Trending", 40),
    "Happy": generateGifs("Happy", 30),
    "Sad": generateGifs("Sad", 30),
    "Celebration": generateGifs("Celebration", 25),
    "Love": generateGifs("Love", 25),
    "Angry": generateGifs("Angry", 20),
    "Confused": generateGifs("Confused", 20),
    "Excited": generateGifs("Excited", 20),
    "Applause": generateGifs("Applause", 15),
    "Animals": generateGifs("Animals", 25),
    "Dance": generateGifs("Dance", 20),
    "Food": generateGifs("Food", 20)
};

export const MOCK_GIFS = Object.values(GIF_CATEGORIES).flat();

export const INITIAL_USERS: User[] = [
    {
        id: 1,
        username: 'unera_official',
        name: 'UNERA Official',
        email: 'admin@unera.social',
        profile_image_url: 'https://ui-avatars.com/api/?name=UNERA+Official&background=1877F2&color=fff',
        cover_image_url: 'https://images.unsplash.com/photo-1557683316-973673baf926?ixlib=rb-1.2.1&auto=format&fit=crop&w=1500&q=80',
        followers: [2, 3],
        following: [2],
        is_verified: true,
        role: 'admin',
        is_online: true,
        location: 'Dar es Salaam, Tanzania',
        bio: 'Welcome to the official UNERA platform. Connect and share with your community.'
    },
    {
        id: 2,
        username: 'johndoe',
        name: 'John Doe',
        email: 'john@example.com',
        profile_image_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
        followers: [1],
        following: [1, 3],
        is_online: true,
        location: 'Nairobi, Kenya',
        bio: 'Tech enthusiast and traveler.'
    },
    {
        id: 3,
        username: 'sarahj',
        name: 'Sarah Johnson',
        email: 'sarah@example.com',
        profile_image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
        followers: [2],
        following: [1],
        is_online: false,
        location: 'Kampala, Uganda',
        bio: 'Digital Artist & Creative Soul.'
    }
];

export const INITIAL_GROUPS: Group[] = [
    {
        // @google/genai-api-fix: Corrected id from string 'g1' to number 1001 to match Group type.
        id: 1001,
        name: 'UNERA Developers',
        description: 'A community for developers building on the UNERA ecosystem.',
        type: 'public',
        profile_image: 'https://ui-avatars.com/api/?name=Developers&background=random',
        cover_image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1500&q=80',
        admin_id: 1,
        members: [1, 2],
        posts: [],
        created_at: new Date().toISOString()
    }
];

export const INITIAL_BRANDS: Brand[] = [
    {
        id: 101,
        name: 'Unera Music',
        description: 'The heartbeat of African music.',
        category: 'Musician/Band',
        profile_image_url: 'https://ui-avatars.com/api/?name=Unera+Music&background=FF0050',
        cover_image_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-1.2.1&auto=format&fit=crop&w=1500&q=80',
        admin_id: 1,
        followers: [1, 2, 3],
        location: 'Lagos, Nigeria',
        is_verified: true,
        created_at: new Date().toISOString()
    }
];

export const INITIAL_EVENTS: Event[] = [
    {
        id: 1,
        creator_id: 1,
        title: 'UNERA Launch Party',
        description: 'Join us as we celebrate the launch of the most innovative social network in Africa!',
        event_date: new Date(Date.now() + 86400000).toISOString(),
        location: 'Dar es Salaam, Tanzania',
        cover_url: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-1.2.1&auto=format&fit=crop&w=1500&q=80',
        attendees: [1, 2, 3],
        interested_ids: [1, 2, 3]
    }
];

export const MOCK_SONGS: Song[] = [
    {
        id: 1,
        uploader_id: 1,
        title: 'Sunrise Over Arusha',
        artist_name: 'Bongo Flava King',
        cover_image_url: 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
        audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        duration_seconds: 245,
        genre: 'Bongo Flava',
        created_at: new Date().toISOString(),
        stats: { plays: 1250, downloads: 450, shares: 120, likes: 800, reels_use: 45 }
    }
];

export const MOCK_ALBUMS: Album[] = [
    {
        id: 'a1',
        title: 'African Rhythm',
        artist: 'Various Artists',
        cover: 'https://images.unsplash.com/photo-1459749411177-042180ce673c?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
        year: '2025',
        songs: ['1']
    }
];

export const MOCK_PODCASTS: any[] = [
    {
        id: 1,
        creator_id: 1,
        title: 'The Tech Savanna',
        host: 'Tech Guru',
        cover_url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
        description: 'Discussing the future of tech in Africa.',
        category: 'Technology',
        followers: 450,
        created_at: new Date().toISOString()
    }
];

export const MOCK_EPISODES: Episode[] = [
    {
        id: 1,
        podcast_id: 1,
        uploader_id: 1,
        title: 'Episode 1: The Rise of AI in Lagos',
        description: 'We dive deep into the silicon savanna of Nigeria.',
        created_at: new Date().toISOString(),
        duration_seconds: 1800,
        audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        cover_image_url: 'https://images.unsplash.com/photo-1478737270239-2fccd27ee086?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
        stats: { plays: 320, downloads: 85, shares: 12, likes: 90, reels_use: 0 }
    }
];

export const TRANSLATIONS: Record<string, any> = {
    en: {
        tagline: "Connect with friends and the world around you on UNERA.",
        login_btn: "Log In",
        home: "Home",
        friends: "Friends",
        create_post_title: "Create Post",
        watch: "Watch",
        reels: "Reels",
        marketplace: "Marketplace",
        groups: "Groups",
        login: "Log In",
        logout: "Log Out",
        forgot_password: "Forgot Password?",
        create_new_account: "Create New Account",
        sign_up_header: "Sign Up",
        quick_easy: "It's quick and easy.",
        first_name: "First name",
        surname_optional: "Surname (optional)",
        dob: "Date of birth",
        gender: "Gender",
        female: "Female",
        male: "Male",
        terms_text: "By clicking Sign Up, you agree to our Terms and Data Policy.",
        sign_up_btn: "Sign Up",
        have_account: "Already have an account?",
        create_reel: "Create Reel"
    },
    sw: {
        tagline: "Ungana na marafiki na ulimwengu unaokuzunguka kupitia UNERA.",
        login_btn: "Ingia",
        home: "Nyumbani",
        friends: "Marafiki",
        create_post_title: "Unda Posti",
        watch: "Tazama",
        reels: "Reels",
        marketplace: "Sokoni",
        groups: "Vikundi",
        login: "Ingia",
        logout: "Ondoka",
        forgot_password: "Umesahau Nywila?",
        create_new_account: "Unda Akaunti Mpya",
        sign_up_header: "Jisajili",
        quick_easy: "Ni haraka na rahisi.",
        first_name: "Jina la kwanza",
        surname_optional: "Jina la ukoo (hiari)",
        dob: "Tarehe ya kuzaliwa",
        gender: "Jinsia",
        female: "Mwanamke",
        male: "Mwanamume",
        terms_text: "Kwa kubonyeza Jisajili, unakubali Sheria na Sera zetu za Takwimu.",
        sign_up_btn: "Jisajili",
        have_account: "Tayari unayo akaunti?",
        create_reel: "Tengeneza Reel"
    }
};
