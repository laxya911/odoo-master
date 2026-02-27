
export interface RestaurantStore {
  id: string;
  name: string;
  nameJp: string;
  address: string;
  phone: string;
  hours: { lunch: string; dinner: string };
  parkingInfo: string;
  note?: string;
}

export interface RestaurantGroup {
  name: string;
  tagline: string;
  taglineJp: string;
  established: string;
  stores: RestaurantStore[];
  socials: {
    facebook: string;
    line: string;
    instagram: string;
  };
}

export interface ProductAttributeValue {
  id: string;
  name: string;
  priceModifier: number;
}

export interface ProductAttribute {
  id: string;
  name: string;
  type: 'radio' | 'checkbox';
  values: ProductAttributeValue[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  nameJp: string;
  description: string;
  descriptionJp: string;
  price: number;
  category: string;
  image_url: string;
  isFeatured?: boolean;
  is_combo?: boolean;
  attributes?: ProductAttribute[];
  rating: number;
  reviewCount: number;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  comment: string;
  outletId: string;
  date: string;
  visitDate: string;
  isVerified: boolean;
}

export interface Testimonial {
  id: string;
  reviewId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  comment: string;
  staffRating: number;
  ambianceRating: number;
  overallRating: number;
  date: string;
  outletId: string;
}

export interface StaffMember {
  id: string;
  name: string;
  designation: string;
  designationJp: string;
  image: string;
  bio: string;
  socials: {
    instagram?: string;
    facebook?: string;
  };
}

export interface GalleryImage {
  id: string;
  url: string;
  title: string;
  category: 'Interior' | 'Exterior' | 'Food' | 'Drinks';
}

export const RAM_GROUP: RestaurantGroup = {
  name: "RAM & CO.",
  tagline: "The Soul of Indian & Nepalese Cuisine in Ibaraki.",
  taglineJp: "本場インドのカレーと雰囲気を存分に楽しみたいなら。",
  established: "1999",
  socials: {
    facebook: "https://facebook.com/ram.mito",
    line: "https://line.me/ram",
    instagram: "https://instagram.com/ram_co_dining"
  },
  stores: [
    {
      id: "mito-minami",
      name: "Mito Minami Main Store",
      nameJp: "水戸南本店",
      address: "3-3-16 Minami-cho, Mito City, Ibaraki, Yamaguchi Bldg 1F",
      phone: "029-233-1765",
      hours: { lunch: "11:00 - 15:00", dinner: "17:00 - 23:00" },
      parkingInfo: "Parking service tickets (200 yen) available for nearby coin parking.",
      note: "Near Mito City Hall and Civil Hall."
    },
    {
      id: "akatsuka",
      name: "Akatsuka Store",
      nameJp: "赤塚店",
      address: "1-1991-27 Akatsuka, Mito City, Ibaraki",
      phone: "029-254-1767",
      hours: { lunch: "11:00 - 15:00", dinner: "17:00 - 23:00" },
      parkingInfo: "Private parking available (5 spaces)."
    },
    {
      id: "hitachinaka",
      name: "Hitachinaka Store",
      nameJp: "ひたちなか店",
      address: "2-15-1 Shaka-cho, Hitachinaka City, Ibaraki",
      phone: "029-272-1768",
      hours: { lunch: "11:00 - 15:00", dinner: "17:30 - 22:30" },
      parkingInfo: "Large shared parking lot available."
    },
    {
      id: "tsuchiura",
      name: "Tsuchiura Store",
      nameJp: "土浦店",
      address: "1-10-5 Manabe, Tsuchiura City, Ibaraki",
      phone: "029-821-1769",
      hours: { lunch: "11:00 - 15:00", dinner: "17:00 - 23:00" },
      parkingInfo: "Front parking for 8 cars.",
      note: "Our newest location near Tsuchiura Station."
    }
  ]
};

const COMMON_ATTRIBUTES = {
  spice: {
    id: "attr_spice",
    name: "Spice Level (辛さ)",
    type: "radio" as const,
    values: [
      { id: "s_mild", name: "Mild (甘口)", priceModifier: 0 },
      { id: "s_medium", name: "Medium (中辛)", priceModifier: 0 },
      { id: "s_hot", name: "Hot (辛口)", priceModifier: 0 },
      { id: "s_vhot", name: "Very Hot (激辛)", priceModifier: 100 }
    ]
  },
  portion: {
    id: "attr_size",
    name: "Portion Size (サイズ)",
    type: "radio" as const,
    values: [
      { id: "p_half", name: "Half Portion (ハーフ)", priceModifier: -300 },
      { id: "p_full", name: "Standard Full (フル)", priceModifier: 0 }
    ]
  },
  drinkCombo: {
    id: "attr_drink",
    name: "Combo Drink (ドリンクセット)",
    type: "radio" as const,
    values: [
      { id: "d_none", name: "No Drink", priceModifier: 0 },
      { id: "d_coke", name: "Coke", priceModifier: 0 },
      { id: "d_fanta", name: "Fanta Orange", priceModifier: 0 },
      { id: "d_lassi", name: "Mango Lassi", priceModifier: 200 },
      { id: "d_chai", name: "Hot Chai", priceModifier: 150 }
    ]
  }
};

export const PRODUCTS: Product[] = [
  {
    id: "c1",
    slug: "butter-chicken-masala",
    name: "Butter Chicken Masala",
    nameJp: "バターチキンマサラ",
    description: "Our #1 best seller. Rich, creamy, and mildly sweet tomato-based curry.",
    descriptionJp: "当店一番人気。濃厚でクリーミー、ほんのり甘いトマトベースのカレー。",
    price: 1250,
    category: "Curry",
    image_url: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=800",
    isFeatured: true,
    attributes: [COMMON_ATTRIBUTES.portion, COMMON_ATTRIBUTES.spice, COMMON_ATTRIBUTES.drinkCombo],
    rating: 4.9,
    reviewCount: 128
  },
  {
    id: "c2",
    slug: "lamb-dum-biryani",
    name: "Lamb Dum Biryani",
    nameJp: "ラム・ダム・ビリヤニ",
    description: "Fragrant basmati rice layered with tender lamb and saffron spices.",
    descriptionJp: "最高級サフランを使用した香り高いバスマティライスの炊き込みご飯。",
    price: 1480,
    category: "Signature",
    image_url: "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?auto=format&fit=crop&q=80&w=800",
    isFeatured: true,
    attributes: [COMMON_ATTRIBUTES.spice, COMMON_ATTRIBUTES.drinkCombo],
    rating: 4.7,
    reviewCount: 85
  },
  {
    id: "m1",
    slug: "steamed-chicken-momo",
    name: "Steamed Chicken Momo",
    nameJp: "蒸し鶏モモ",
    description: "Nepalese style dumplings served with spicy tomato sesame chutney.",
    descriptionJp: "スパイシーなトマトとゴマのチャツネを添えた、ネパール風の蒸し餃子。",
    price: 850,
    category: "Signature",
    image_url: "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b4?auto=format&fit=crop&q=80&w=800",
    attributes: [
      {
        id: "attr_momo_style",
        name: "Momo Style",
        type: "radio",
        values: [
          { id: "ms_steamed", name: "Steamed", priceModifier: 0 },
          { id: "ms_fried", name: "Fried", priceModifier: 100 },
          { id: "ms_soup", name: "Soup (Jhol)", priceModifier: 200 }
        ]
      }
    ],
    rating: 4.8,
    reviewCount: 210
  },
  {
    id: "n1",
    slug: "cheese-naan",
    name: "Cheese Naan",
    nameJp: "チーズナン",
    description: "Fluffy tandoor-baked bread stuffed with premium cheese.",
    descriptionJp: "とろ～りチーズが溢れ出す、タンドール釜で焼いたふわふわのパン。",
    price: 550,
    category: "Side",
    image_url: "https://images.unsplash.com/photo-1601050633647-81a317379291?auto=format&fit=crop&q=80&w=800",
    isFeatured: true,
    attributes: [
      {
        id: "attr_honey",
        name: "Honey Options",
        type: "radio",
        values: [
          { id: "h_none", name: "No Honey", priceModifier: 0 },
          { id: "h_yes", name: "Add Honey", priceModifier: 150 }
        ]
      }
    ],
    rating: 4.6,
    reviewCount: 320
  },
  {
    id: "c3",
    slug: "palak-paneer",
    name: "Palak Paneer",
    nameJp: "パラクパニール",
    description: "Fresh spinach puree with homemade cottage cheese cubes.",
    descriptionJp: "新鮮なほうれん草のピューレと自家製カッテージチーズのカレー。",
    price: 1100,
    category: "Curry",
    image_url: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&q=80&w=800",
    attributes: [COMMON_ATTRIBUTES.spice, COMMON_ATTRIBUTES.portion],
    rating: 4.5,
    reviewCount: 65
  },
  {
    id: "t1",
    slug: "tandoori-chicken-platter",
    name: "Tandoori Chicken Platter",
    nameJp: "タンドリーチキンプラッター",
    description: "Spiced chicken leg marinated in yogurt and grilled in clay oven.",
    descriptionJp: "ヨーグルトとスパイスに漬け込み、タンドールで焼き上げた骨付きチキン。",
    price: 1850,
    category: "Signature",
    image_url: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&q=80&w=800",
    isFeatured: true,
    attributes: [COMMON_ATTRIBUTES.drinkCombo],
    rating: 4.9,
    reviewCount: 142
  }
];

export const REVIEWS: Review[] = [
  {
    id: "r1",
    productId: "c1",
    userId: "u1",
    userName: "Kenji Sato",
    userAvatar: "https://picsum.photos/seed/kenji/100/100",
    rating: 5,
    comment: "The best butter chicken I've had in Japan. Truly authentic!",
    outletId: "mito-minami",
    date: "2024-03-15",
    visitDate: "2024-03-10",
    isVerified: true
  },
  {
    id: "r2",
    productId: "c2",
    userId: "u2",
    userName: "Maria Garcia",
    userAvatar: "https://picsum.photos/seed/maria/100/100",
    rating: 4,
    comment: "Excellent spice balance. The lamb was very tender.",
    outletId: "tsuchiura",
    date: "2024-03-18",
    visitDate: "2024-03-17",
    isVerified: true
  },
  {
    id: "r3",
    productId: "m1",
    userId: "u3",
    userName: "Yuki Tanaka",
    userAvatar: "https://picsum.photos/seed/yuki/100/100",
    rating: 5,
    comment: "Those momos are exactly like the ones I had in Kathmandu. 5 stars!",
    outletId: "hitachinaka",
    date: "2024-03-20",
    visitDate: "2024-03-15",
    isVerified: true
  }
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "t1",
    reviewId: "r1",
    userId: "u1",
    userName: "Kenji Sato",
    userAvatar: "https://picsum.photos/seed/kenji/100/100",
    comment: "Wonderful ambiance at Mito store. The staff was incredibly welcoming.",
    staffRating: 5,
    ambianceRating: 5,
    overallRating: 5,
    date: "2024-03-15",
    outletId: "mito-minami"
  },
  {
    id: "t2",
    reviewId: "r2",
    userId: "u2",
    userName: "Maria Garcia",
    userAvatar: "https://picsum.photos/seed/maria/100/100",
    comment: "Very clean environment and great service. Will definitely visit again.",
    staffRating: 4,
    ambianceRating: 5,
    overallRating: 4.5,
    date: "2024-03-18",
    outletId: "tsuchiura"
  },
  {
    id: "t3",
    reviewId: "r3",
    userId: "u3",
    userName: "Yuki Tanaka",
    userAvatar: "https://picsum.photos/seed/yuki/100/100",
    comment: "The Hitachinaka branch has such a warm vibe. Perfect for family dinner.",
    staffRating: 5,
    ambianceRating: 4,
    overallRating: 4.5,
    date: "2024-03-20",
    outletId: "hitachinaka"
  }
];

export const STAFF: StaffMember[] = [
  {
    id: "s1",
    name: "Arjun Ram",
    designation: "Executive Chef",
    designationJp: "エグゼクティブ・シェフ",
    image: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&q=80&w=500",
    bio: "25+ years experience in Nepal and India, mastering the tandoor and secret spice blends.",
    socials: { instagram: "https://instagram.com/chef_arjun_ram" }
  },
  {
    id: "s2",
    name: "Lakpa Sherpa",
    designation: "Momo Specialist",
    designationJp: "モモ・スペシャリスト",
    image: "https://images.unsplash.com/photo-1647483684830-7ddde27dcf4d?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    bio: "Hailing from the Himalayas, Lakpa brings authentic dumpling techniques to your plate.",
    socials: { facebook: "https://facebook.com/lakpa_momo" }
  },
  {
    id: "s3",
    name: "Priyanka Sharma",
    designation: "General Manager",
    designationJp: "ゼネラルマネージャー",
    image: "https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&q=80&w=500",
    bio: "Ensuring hospitality standards across all Ibaraki branches since 2010.",
    socials: { instagram: "https://instagram.com/priyanka_ramco" }
  },
  {
    id: "s4",
    name: "Ramesh Thapa",
    designation: "Tandoor Master",
    designationJp: "タンドール・マスター",
    image: "https://images.unsplash.com/photo-1566554273541-37a9ca77b91f?auto=format&fit=crop&q=80&w=500",
    bio: "Ramesh is the heart of our kitchen, controlling the intense heat of the clay oven.",
    socials: { instagram: "https://instagram.com/ramesh_tandoor" }
  }
];

export const GALLERY: GalleryImage[] = [
  { id: "g1", url: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&q=80&w=1000", title: "Elegant Dining Hall", category: "Interior" },
  { id: "g2", url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1000", title: "Open Kitchen View", category: "Interior" },
  { id: "g3", url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=1000", title: "Signature Naan Preparation", category: "Food" },
  { id: "g4", url: "https://images.unsplash.com/photo-1585937421612-71a010d71575?auto=format&fit=crop&q=80&w=1000", title: "Mito Main Entrance", category: "Exterior" },
  { id: "g5", url: "https://images.unsplash.com/photo-1544145945-f904253d0c7b?auto=format&fit=crop&q=80&w=1000", title: "Artisan Mango Lassi", category: "Drinks" },
  { id: "g6", url: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&q=80&w=1000", title: "Spicy Tandoori Platter", category: "Food" }
];

export const CATEGORIES = [
  { id: 1, name: 'Curry', icon: 'Utensils' },
  { id: 2, name: 'Signature', icon: 'Star' },
  { id: 3, name: 'Side', icon: 'Bowl' },
  { id: 4, name: 'Drinks', icon: 'Beer' }
];

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'delivering' | 'delivered';

export interface CartItem {
  cartId: string;
  product: Product;
  selectedAttributes: Record<string, string | string[]>;
  quantity: number;
  note: string;
}

export const formatPrice = (amount: number) => {
  return `¥${amount.toLocaleString()}`;
};
