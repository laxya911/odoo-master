import { MenuItem, RestaurantGroup, StaffMember, GalleryImage } from './mock-types';

export const RAM_GROUP: RestaurantGroup = {
  name: "RAM Indian Restaurant",
  tagline: "The Soul of Indian & Nepalese Cuisine in Ibaraki.",
  taglineJp: "本場インドのカレーと雰囲気を存分に楽しみたいなら。",
  established: "1999",
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
    name: "Spice Level",
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
    name: "Portion Size",
    type: "radio" as const,
    values: [
      { id: "p_half", name: "Half Portion", priceModifier: -300 },
      { id: "p_full", name: "Standard Full", priceModifier: 0 }
    ]
  },
  riceType: {
    id: "attr_rice",
    name: "Rice Selection",
    type: "radio" as const,
    values: [
      { id: "r_basmati", name: "Basmati Rice", priceModifier: 200 },
      { id: "r_japanese", name: "Japanese White Rice", priceModifier: 0 }
    ]
  }
};

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 1,
    slug: "butter-chicken-masala",
    name: "Butter Chicken Masala",
    nameJp: "バターチキンマサラ",
    description: "Our #1 best seller. Rich, creamy, and mildly sweet tomato-based curry with tandoori chicken.",
    descriptionJp: "当店一番人気。濃厚でクリーミー、ほんのり甘いトマトベースのカレー。",
    price: 1250,
    category: "Curry",
    image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=800",
    isFeatured: true,
    attributes: [COMMON_ATTRIBUTES.portion, COMMON_ATTRIBUTES.spice]
  },
  {
    id: 2,
    slug: "chicken-dum-biryani",
    name: "Chicken Dum Biryani",
    nameJp: "チキン・ダム・ビリヤニ",
    description: "Fragrant basmati rice layered with tender chicken and premium saffron spices.",
    descriptionJp: "柔らかいチキン肉と最高級サフランを使用した香り高いバスマティライスの炊き込みご飯。",
    price: 1480,
    category: "Signature",
    image: "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?q=80&w=1188&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    isFeatured: true,
    attributes: [COMMON_ATTRIBUTES.spice]
  },
  {
    id: 3,
    slug: "dal-makhani",
    name: "Dal Makhani",
    nameJp: "ダルマカニ",
    description: "Black lentils slow-cooked overnight with cream and butter for ultimate richness.",
    descriptionJp: "黒レンズ豆をクリームとバターで一晩じっくり煮込んだ、究極に濃厚なダルカレー。",
    price: 1050,
    category: "Curry",
    isFeatured: true,
    image: "/images/foods_drinks/dal-makhani.jpg",
    attributes: [COMMON_ATTRIBUTES.spice]
  },
  {
    id: 4,
    slug: "tandoori-chicken-platter",
    name: "Tandoori Chicken Platter",
    nameJp: "タンドリーチキン・プラッター",
    description: "Classic bone-in chicken marinated in yogurt and 12 spices, roasted in clay oven.",
    descriptionJp: "ヨーグルトと12種類のスパイスに漬け込み、土釜（タンドール）で焼き上げた骨付きチキン。",
    price: 1100,
    category: "Side",
    image: "/images/foods_drinks/tandoori-chicken.jpg",
    attributes: [
      {
        id: "attr_pcs",
        name: "Serving Size",
        type: "radio",
        values: [
          { id: "pcs_2", name: "2 Pieces", priceModifier: 0 },
          { id: "pcs_4", name: "4 Pieces", priceModifier: 800 }
        ]
      }
    ]
  },
  {
    id: 5,
    slug: "steamed-chicken-momo",
    name: "Steamed Chicken Momo",
    nameJp: "蒸し鶏モモ",
    description: "Nepalese style dumplings served with spicy tomato sesame chutney.",
    descriptionJp: "スパイシーなトマトとゴマのチャツネを添えた、ネパール風の蒸し餃子。",
    price: 850,
    category: "Signature",
    image: "/images/foods_drinks/steam-momos.jpg",
    attributes: [
      {
        id: "attr_momo_style",
        name: "Style",
        type: "radio",
        values: [
          { id: "ms_steamed", name: "Steamed", priceModifier: 0 },
          { id: "ms_fried", name: "Fried", priceModifier: 100 },
          { id: "ms_soup", name: "Soup (Jhol)", priceModifier: 200 }
        ]
      }
    ]
  },
  {
    id: 6,
    slug: "cheese-naan",
    name: "Cheese Naan",
    nameJp: "チーズナン",
    description: "Fluffy tandoor-baked bread stuffed with overflowing premium cheese.",
    descriptionJp: "とろ～りチーズが溢れ出す、タンドール釜で焼いたふわふわのパン。",
    price: 550,
    category: "Side",
    image: "/images/foods_drinks/Cheesy-Garlic-Naan.jpg",
    isFeatured: true,
    attributes: [
      {
        id: "attr_honey",
        name: "Honey Drizzle",
        type: "radio",
        values: [
          { id: "h_none", name: "No Honey", priceModifier: 0 },
          { id: "h_yes", name: "Add Organic Honey", priceModifier: 150 }
        ]
      }
    ]
  },
  {
    id: 7,
    slug: "ram-special-thali-set",
    name: "Ram Special Thali Set",
    nameJp: "ラム・スペシャル・ターリーセット",
    description: "A complete meal with two curries, naan, rice, salad, and dessert.",
    descriptionJp: "カレー2種、ナン、ライス、サラダ、デザートがついたお得な定食スタイル。",
    price: 1550,
    category: "Lunch",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800",
    attributes: [COMMON_ATTRIBUTES.spice, COMMON_ATTRIBUTES.riceType]
  },
  {
    id: 8,
    slug: "mango-lassi",
    name: "Mango Lassi",
    nameJp: "マンゴーラッシー",
    description: "Smooth yogurt blended with premium Indian Alphonso mangoes.",
    descriptionJp: "最高級アルフォンソマンゴーを使用した、濃厚なヨーグルトドリンク。",
    price: 480,
    category: "Drinks",
    image: "/images/foods_drinks/Mango-Lassi.jpg",
    attributes: [
      {
        id: "attr_ice",
        name: "Ice Level",
        type: "radio",
        values: [
          { id: "i_norm", name: "Normal Ice", priceModifier: 0 },
          { id: "i_less", name: "Less Ice", priceModifier: 0 },
          { id: "i_none", name: "No Ice", priceModifier: 0 }
        ]
      }
    ]
  }
];

export const STAFF: StaffMember[] = [
  {
    id: "s1",
    name: "Arjun Ram",
    designation: "Executive Chef",
    designationJp: "エグゼクティブ・シェフ",
    image: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&q=80&w=500",
    bio: "With over 25 years of experience in Nepal and India, Chef Arjun brings secret family recipes to Ibaraki.",
    socials: {
      instagram: "https://instagram.com/chef_arjun_ram"
    }
  },
  {
    id: "s2",
    name: "Sarah Tanaka",
    designation: "Restaurant Manager",
    designationJp: "店長 / マネージャー",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=500",
    bio: "Sarah ensures the perfect bridge between Himalayan hospitality and Japanese Omotenashi service.",
    socials: {
      facebook: "https://facebook.com/sarah.ram.mito"
    }
  },
  {
    id: "s3",
    name: "Vikram Singh",
    designation: "Tandoor Master",
    designationJp: "タンドール・マスター",
    image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&q=80&w=500",
    bio: "Specializing in high-temperature clay oven cooking, Vikram crafts our famous hand-stretched naan.",
    socials: {
      instagram: "https://instagram.com/vikram_tandoor"
    }
  },
  {
    id: "s4",
    name: "Narayan Gopal",
    designation: "Head Waiter",
    designationJp: "ヘッドウェイター",
    image: "https://images.unsplash.com/photo-1647483684830-7ddde27dcf4d?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    bio: "With over 15 years of experience in Nepal and India, Narayan Gopal ensures the perfect service experience for our guests.",
    socials: {
      instagram: "https://instagram.com/narayan_gopal"
    }
  }
];

export const GALLERY: GalleryImage[] = [
  {
    id: "g1",
    url: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&q=80&w=1000",
    title: "Elegant Dining Hall",
    category: "Interior"
  },
  {
    id: "g2",
    url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1000",
    title: "Atmospheric Lighting",
    category: "Interior"
  },
  {
    id: "g3",
    url: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=1000",
    title: "Signature Platter",
    category: "Food"
  },
  {
    id: "g4",
    url: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=1000",
    title: "Spices & Aromas",
    category: "Food"
  },
  {
    id: "g5",
    url: "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=1000",
    title: "Mito Main Store Front",
    category: "Exterior"
  },
  {
    id: "g6",
    url: "/images/foods_drinks/steam-momos.jpg",
    title: "Homemade Momo",
    category: "Food"
  },
  {
    id: "g7",
    url: "/images/foods_drinks/tandoori-chicken.jpg",
    title: "Tandoori Chicken",
    category: "Food"
  },
  {
    id: "g8",
    url: "/images/foods_drinks/Cheesy-Garlic-Naan.jpg",
    title: "Cheesy Garlic Naan",
    category: "Food"
  },
  {
    id: "g9",
    url: "/images/foods_drinks/Mango-Lassi.jpg",
    title: "Mango Lassi",
    category: "Food"
  },
  {
    id: "g10",
    url: "/images/foods_drinks/dal-makhani.jpg",
    title: "Dal Makhani",
    category: "Food"
  },

];
