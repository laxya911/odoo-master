export interface MenuItem {
  id: number;
  slug: string;
  name: string;
  nameJp?: string;
  description: string;
  descriptionJp?: string;
  price: number;
  category: string;
  image: string;
  isFeatured?: boolean;
  attributes?: any[];
}

export interface Store {
  id: string;
  name: string;
  nameJp: string;
  address: string;
  phone: string;
  hours: { lunch: string; dinner: string };
  parkingInfo?: string;
  note?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  designation: string;
  designationJp?: string;
  image: string;
  bio: string;
  socials?: {
    instagram?: string;
    facebook?: string;
  };
}

export interface GalleryImage {
  id: string;
  url: string;
  title: string;
  category: string;
}

export interface RestaurantGroup {
  name: string;
  tagline: string;
  taglineJp: string;
  established: string;
  stores: Store[];
}
