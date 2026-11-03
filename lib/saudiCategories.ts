// Go Bharat-inspired 5-column taxonomy adapted for Go Saudi.
// Content classification only: does not authorize regulated sales, staffing,
// medical, travel, insurance, chemical or other licensed activities.
export type SaudiGroupId = "b2b" | "b2c" | "service" | "manpower" | "travel";
export type SaudiMainCategory = {
  id: SaudiGroupId; en:string; ar:string; emoji:string;
  subtitleEn:string; subtitleAr:string; color:string;
};
export type SaudiSubcategory = {
 id:string; group:SaudiGroupId; en:string; ar:string; emoji:string;
};
export const saudiMainCategories: SaudiMainCategory[] = [
  {
    "id": "b2b",
    "en": "B2B",
    "ar": "تجارة الجملة",
    "emoji": "🏭",
    "subtitleEn": "Wholesale & supplies",
    "subtitleAr": "الجملة والتوريدات",
    "color": "#2e78ab"
  },
  {
    "id": "b2c",
    "en": "B2C",
    "ar": "تسوق الأفراد",
    "emoji": "🛍️",
    "subtitleEn": "Daily shopping",
    "subtitleAr": "تسوق المنتجات",
    "color": "#ba7141"
  },
  {
    "id": "service",
    "en": "Services",
    "ar": "الخدمات",
    "emoji": "🛠️",
    "subtitleEn": "Local services",
    "subtitleAr": "خدمات محلية",
    "color": "#8454a9"
  },
  {
    "id": "manpower",
    "en": "Manpower",
    "ar": "القوى العاملة",
    "emoji": "👷",
    "subtitleEn": "Workers & staffing",
    "subtitleAr": "العمالة والتوظيف",
    "color": "#298276"
  },
  {
    "id": "travel",
    "en": "Travel",
    "ar": "السفر",
    "emoji": "✈️",
    "subtitleEn": "Transport & trips",
    "subtitleAr": "السفر والمواصلات",
    "color": "#b6566b"
  }
];
export const saudiSubcategories: SaudiSubcategory[] = [
  {
    "id": "sc1",
    "group": "b2b",
    "en": "Wholesale Grocery",
    "ar": "مواد غذائية بالجملة",
    "emoji": "🛒"
  },
  {
    "id": "sc2",
    "group": "b2b",
    "en": "Industrial Supplies",
    "ar": "مستلزمات صناعية",
    "emoji": "🏭"
  },
  {
    "id": "sc3",
    "group": "b2b",
    "en": "Office Equipment",
    "ar": "معدات مكتبية",
    "emoji": "🖨️"
  },
  {
    "id": "sc4",
    "group": "b2b",
    "en": "Raw Materials",
    "ar": "مواد خام",
    "emoji": "🧱"
  },
  {
    "id": "sc19",
    "group": "b2b",
    "en": "Packaging Materials",
    "ar": "مواد التغليف",
    "emoji": "📦"
  },
  {
    "id": "sc20",
    "group": "b2b",
    "en": "Industrial Chemicals",
    "ar": "مواد كيميائية صناعية",
    "emoji": "⚗️"
  },
  {
    "id": "sc21",
    "group": "b2b",
    "en": "Textile Raw Materials",
    "ar": "مواد خام للنسيج",
    "emoji": "🧵"
  },
  {
    "id": "sc22",
    "group": "b2b",
    "en": "Agricultural Inputs",
    "ar": "مستلزمات زراعية",
    "emoji": "🌾"
  },
  {
    "id": "sc23",
    "group": "b2b",
    "en": "Construction Materials",
    "ar": "مواد البناء",
    "emoji": "🏗️"
  },
  {
    "id": "sc24",
    "group": "b2b",
    "en": "Auto Parts Wholesale",
    "ar": "قطع غيار سيارات بالجملة",
    "emoji": "🚗"
  },
  {
    "id": "sc25",
    "group": "b2b",
    "en": "Paper & Printing",
    "ar": "ورق وطباعة",
    "emoji": "🗞️"
  },
  {
    "id": "sc26",
    "group": "b2b",
    "en": "Electrical Components",
    "ar": "مكونات كهربائية",
    "emoji": "🔌"
  },
  {
    "id": "sc27",
    "group": "b2b",
    "en": "Plumbing Supplies",
    "ar": "مستلزمات السباكة",
    "emoji": "🚰"
  },
  {
    "id": "sc28",
    "group": "b2b",
    "en": "Safety Equipment",
    "ar": "معدات السلامة",
    "emoji": "🦺"
  },
  {
    "id": "sc29",
    "group": "b2b",
    "en": "Restaurant Supplies",
    "ar": "مستلزمات المطاعم",
    "emoji": "🍽️"
  },
  {
    "id": "sc30",
    "group": "b2b",
    "en": "Medical Equipment",
    "ar": "معدات طبية",
    "emoji": "🩺"
  },
  {
    "id": "sc31",
    "group": "b2b",
    "en": "IT Equipment Bulk",
    "ar": "معدات تقنية بالجملة",
    "emoji": "💻"
  },
  {
    "id": "sc32",
    "group": "b2b",
    "en": "Furniture Wholesale",
    "ar": "أثاث بالجملة",
    "emoji": "🪑"
  },
  {
    "id": "sc33",
    "group": "b2b",
    "en": "Cleaning Supplies",
    "ar": "مستلزمات النظافة",
    "emoji": "🧹"
  },
  {
    "id": "sc34",
    "group": "b2b",
    "en": "Craft Materials",
    "ar": "مواد الحرف",
    "emoji": "🎨"
  },
  {
    "id": "sc35",
    "group": "b2b",
    "en": "Steel & Metals",
    "ar": "حديد ومعادن",
    "emoji": "🔩"
  },
  {
    "id": "sc36",
    "group": "b2b",
    "en": "Plastic Products",
    "ar": "منتجات بلاستيكية",
    "emoji": "🧴"
  },
  {
    "id": "sc37",
    "group": "b2b",
    "en": "Timber & Wood",
    "ar": "أخشاب",
    "emoji": "🪵"
  },
  {
    "id": "sc38",
    "group": "b2b",
    "en": "Jewellery Wholesale",
    "ar": "مجوهرات بالجملة",
    "emoji": "💎"
  },
  {
    "id": "sc39",
    "group": "b2b",
    "en": "Stationery Wholesale",
    "ar": "قرطاسية بالجملة",
    "emoji": "✏️"
  },
  {
    "id": "sc40",
    "group": "b2b",
    "en": "FMCG Distribution",
    "ar": "توزيع السلع الاستهلاكية",
    "emoji": "🏪"
  },
  {
    "id": "sc41",
    "group": "b2b",
    "en": "Pharmaceutical Wholesale",
    "ar": "أدوية بالجملة",
    "emoji": "💊"
  },
  {
    "id": "sc42",
    "group": "b2b",
    "en": "Building Hardware",
    "ar": "عدد البناء",
    "emoji": "🔨"
  },
  {
    "id": "sc43",
    "group": "b2b",
    "en": "Tools & Machinery",
    "ar": "أدوات وآلات",
    "emoji": "⚙️"
  },
  {
    "id": "sc5",
    "group": "b2c",
    "en": "Food & Dining",
    "ar": "الطعام والمطاعم",
    "emoji": "🍱"
  },
  {
    "id": "sc6",
    "group": "b2c",
    "en": "Fashion & Lifestyle",
    "ar": "الأزياء والموضة",
    "emoji": "👗"
  },
  {
    "id": "sc7",
    "group": "b2c",
    "en": "Electronics & Gadgets",
    "ar": "الإلكترونيات والأجهزة",
    "emoji": "📱"
  },
  {
    "id": "sc8",
    "group": "b2c",
    "en": "Health & Beauty",
    "ar": "الصحة والجمال",
    "emoji": "💄"
  },
  {
    "id": "sc9",
    "group": "b2c",
    "en": "Grocery & Daily Needs",
    "ar": "البقالة والاحتياجات اليومية",
    "emoji": "🛒"
  },
  {
    "id": "sc10",
    "group": "b2c",
    "en": "Home & Living",
    "ar": "المنزل والمعيشة",
    "emoji": "🏠"
  },
  {
    "id": "sc44",
    "group": "b2c",
    "en": "Bakery & Sweets",
    "ar": "المخابز والحلويات",
    "emoji": "🧁"
  },
  {
    "id": "sc45",
    "group": "b2c",
    "en": "Footwear",
    "ar": "الأحذية",
    "emoji": "👟"
  },
  {
    "id": "sc46",
    "group": "b2c",
    "en": "Toys & Games",
    "ar": "الألعاب",
    "emoji": "🧸"
  },
  {
    "id": "sc47",
    "group": "b2c",
    "en": "Books & Stationery",
    "ar": "الكتب والقرطاسية",
    "emoji": "📚"
  },
  {
    "id": "sc48",
    "group": "b2c",
    "en": "Sports & Fitness",
    "ar": "الرياضة واللياقة",
    "emoji": "🏋️"
  },
  {
    "id": "sc49",
    "group": "b2c",
    "en": "Pet Supplies",
    "ar": "مستلزمات الحيوانات الأليفة",
    "emoji": "🐾"
  },
  {
    "id": "sc50",
    "group": "b2c",
    "en": "Flowers & Gifts",
    "ar": "الزهور والهدايا",
    "emoji": "💐"
  },
  {
    "id": "sc51",
    "group": "b2c",
    "en": "Watches & Accessories",
    "ar": "الساعات والإكسسوارات",
    "emoji": "⌚"
  },
  {
    "id": "sc52",
    "group": "b2c",
    "en": "Baby & Kids",
    "ar": "الأطفال والرضع",
    "emoji": "🧸"
  },
  {
    "id": "sc53",
    "group": "b2c",
    "en": "Eyewear",
    "ar": "النظارات",
    "emoji": "🕶️"
  },
  {
    "id": "sc54",
    "group": "b2c",
    "en": "Luggage & Bags",
    "ar": "الحقائب والأمتعة",
    "emoji": "🧳"
  },
  {
    "id": "sc55",
    "group": "b2c",
    "en": "Musical Instruments",
    "ar": "الآلات الموسيقية",
    "emoji": "🎵"
  },
  {
    "id": "sc56",
    "group": "b2c",
    "en": "Arts & Crafts",
    "ar": "الفنون والحرف",
    "emoji": "🎨"
  },
  {
    "id": "sc57",
    "group": "b2c",
    "en": "Mobile Accessories",
    "ar": "إكسسوارات الجوال",
    "emoji": "📲"
  },
  {
    "id": "sc58",
    "group": "b2c",
    "en": "Organic & Natural",
    "ar": "منتجات طبيعية وعضوية",
    "emoji": "🌿"
  },
  {
    "id": "sc59",
    "group": "b2c",
    "en": "Dry Fruits & Dates",
    "ar": "التمور والمكسرات",
    "emoji": "🌴"
  },
  {
    "id": "sc60",
    "group": "b2c",
    "en": "Kitchen Appliances",
    "ar": "أجهزة المطبخ",
    "emoji": "🍳"
  },
  {
    "id": "sc61",
    "group": "b2c",
    "en": "Jewellery & Ornaments",
    "ar": "المجوهرات والحلي",
    "emoji": "💍"
  },
  {
    "id": "sc62",
    "group": "b2c",
    "en": "Auto Accessories",
    "ar": "إكسسوارات السيارات",
    "emoji": "🚘"
  },
  {
    "id": "sc63",
    "group": "b2c",
    "en": "Coffee & Dates",
    "ar": "القهوة والتمور",
    "emoji": "☕"
  },
  {
    "id": "sc64",
    "group": "b2c",
    "en": "Snacks & Beverages",
    "ar": "الوجبات الخفيفة والمشروبات",
    "emoji": "🥤"
  },
  {
    "id": "sc65",
    "group": "b2c",
    "en": "Traditional Saudi Clothing",
    "ar": "الأزياء السعودية التقليدية",
    "emoji": "👘"
  },
  {
    "id": "sc66",
    "group": "b2c",
    "en": "Oud & Incense",
    "ar": "العود والبخور",
    "emoji": "🪵"
  },
  {
    "id": "sc67",
    "group": "b2c",
    "en": "Gift Articles",
    "ar": "منتجات الهدايا",
    "emoji": "🎁"
  },
  {
    "id": "sc68",
    "group": "b2c",
    "en": "Personal Care",
    "ar": "العناية الشخصية",
    "emoji": "🧴"
  },
  {
    "id": "sc11",
    "group": "service",
    "en": "Home Services",
    "ar": "خدمات منزلية",
    "emoji": "🏠"
  },
  {
    "id": "sc12",
    "group": "service",
    "en": "Beauty & Wellness",
    "ar": "الجمال والعافية",
    "emoji": "💆"
  },
  {
    "id": "sc13",
    "group": "service",
    "en": "Repair & Maintenance",
    "ar": "الإصلاح والصيانة",
    "emoji": "🔧"
  },
  {
    "id": "sc14",
    "group": "service",
    "en": "Professional Services",
    "ar": "خدمات مهنية",
    "emoji": "💼"
  },
  {
    "id": "sc69",
    "group": "service",
    "en": "Cleaning Services",
    "ar": "خدمات التنظيف",
    "emoji": "🧹"
  },
  {
    "id": "sc70",
    "group": "service",
    "en": "Pest Control",
    "ar": "مكافحة الآفات",
    "emoji": "🐜"
  },
  {
    "id": "sc71",
    "group": "service",
    "en": "Interior Design",
    "ar": "التصميم الداخلي",
    "emoji": "🛋️"
  },
  {
    "id": "sc72",
    "group": "service",
    "en": "Photography",
    "ar": "التصوير",
    "emoji": "📸"
  },
  {
    "id": "sc73",
    "group": "service",
    "en": "Catering Services",
    "ar": "خدمات الضيافة",
    "emoji": "🍽️"
  },
  {
    "id": "sc74",
    "group": "service",
    "en": "Tutoring & Coaching",
    "ar": "التعليم والتدريب",
    "emoji": "📖"
  },
  {
    "id": "sc75",
    "group": "service",
    "en": "Fitness Training",
    "ar": "التدريب الرياضي",
    "emoji": "🏋️"
  },
  {
    "id": "sc76",
    "group": "service",
    "en": "Event Decoration",
    "ar": "تنسيق المناسبات",
    "emoji": "🎊"
  },
  {
    "id": "sc77",
    "group": "service",
    "en": "Travel & Tourism Services",
    "ar": "الخدمات السياحية",
    "emoji": "🧭"
  },
  {
    "id": "sc78",
    "group": "service",
    "en": "Event Management",
    "ar": "تنظيم الفعاليات",
    "emoji": "🎪"
  },
  {
    "id": "sc79",
    "group": "service",
    "en": "Legal Services",
    "ar": "الخدمات القانونية",
    "emoji": "⚖️"
  },
  {
    "id": "sc80",
    "group": "service",
    "en": "Accounting & Tax",
    "ar": "المحاسبة والضرائب",
    "emoji": "🧾"
  },
  {
    "id": "sc81",
    "group": "service",
    "en": "Healthcare Services",
    "ar": "الخدمات الصحية",
    "emoji": "🩺"
  },
  {
    "id": "sc82",
    "group": "service",
    "en": "Pet Care",
    "ar": "رعاية الحيوانات الأليفة",
    "emoji": "🐶"
  },
  {
    "id": "sc83",
    "group": "service",
    "en": "Courier & Logistics",
    "ar": "التوصيل والخدمات اللوجستية",
    "emoji": "📦"
  },
  {
    "id": "sc84",
    "group": "service",
    "en": "Car Wash & Detailing",
    "ar": "غسيل وتلميع السيارات",
    "emoji": "🚘"
  },
  {
    "id": "sc85",
    "group": "service",
    "en": "Tailoring & Alterations",
    "ar": "الخياطة والتعديل",
    "emoji": "🧵"
  },
  {
    "id": "sc86",
    "group": "service",
    "en": "Printing & Signage",
    "ar": "الطباعة واللوحات",
    "emoji": "🖨️"
  },
  {
    "id": "sc87",
    "group": "service",
    "en": "IT Support",
    "ar": "الدعم التقني",
    "emoji": "💻"
  },
  {
    "id": "sc88",
    "group": "service",
    "en": "Insurance & Finance Services",
    "ar": "خدمات التأمين والتمويل",
    "emoji": "🛡️"
  },
  {
    "id": "sc15",
    "group": "manpower",
    "en": "Delivery Partners",
    "ar": "مندوبي التوصيل",
    "emoji": "🛵"
  },
  {
    "id": "sc16",
    "group": "manpower",
    "en": "Skilled Workers",
    "ar": "العمالة الماهرة",
    "emoji": "👷"
  },
  {
    "id": "sc17",
    "group": "manpower",
    "en": "Domestic Help",
    "ar": "المساعدة المنزلية",
    "emoji": "🧹"
  },
  {
    "id": "sc18",
    "group": "manpower",
    "en": "Event Staff",
    "ar": "طاقم الفعاليات",
    "emoji": "🎪"
  },
  {
    "id": "sc89",
    "group": "manpower",
    "en": "Security Staff",
    "ar": "موظفو الأمن",
    "emoji": "🛡️"
  },
  {
    "id": "sc90",
    "group": "manpower",
    "en": "Drivers",
    "ar": "السائقون",
    "emoji": "🚗"
  },
  {
    "id": "sc91",
    "group": "manpower",
    "en": "Chefs & Cooks",
    "ar": "الطهاة",
    "emoji": "👨‍🍳"
  },
  {
    "id": "sc92",
    "group": "manpower",
    "en": "Warehouse Staff",
    "ar": "عمال المستودعات",
    "emoji": "📦"
  },
  {
    "id": "sc93",
    "group": "manpower",
    "en": "Construction Workers",
    "ar": "عمال البناء",
    "emoji": "🏗️"
  },
  {
    "id": "sc94",
    "group": "manpower",
    "en": "Factory Workers",
    "ar": "عمال المصانع",
    "emoji": "🏭"
  },
  {
    "id": "sc95",
    "group": "manpower",
    "en": "Office Support",
    "ar": "الدعم المكتبي",
    "emoji": "💼"
  },
  {
    "id": "sc96",
    "group": "manpower",
    "en": "AC & Refrigeration Technicians",
    "ar": "فنيو التكييف والتبريد",
    "emoji": "❄️"
  },
  {
    "id": "sc97",
    "group": "manpower",
    "en": "Welders & Fabricators",
    "ar": "اللحامون والفنيون",
    "emoji": "🔥"
  },
  {
    "id": "sc98",
    "group": "manpower",
    "en": "Data Entry & Admin",
    "ar": "إدخال البيانات والإدارة",
    "emoji": "💻"
  },
  {
    "id": "sc99",
    "group": "manpower",
    "en": "Sales & Promoters",
    "ar": "المبيعات والترويج",
    "emoji": "📊"
  },
  {
    "id": "sc100",
    "group": "manpower",
    "en": "Packing & Logistics",
    "ar": "التعبئة والخدمات اللوجستية",
    "emoji": "📦"
  },
  {
    "id": "sc101",
    "group": "travel",
    "en": "Bus & Coach",
    "ar": "الحافلات",
    "emoji": "🚌"
  },
  {
    "id": "sc102",
    "group": "travel",
    "en": "Taxi & Transport",
    "ar": "سيارات الأجرة والنقل",
    "emoji": "🚕"
  },
  {
    "id": "sc103",
    "group": "travel",
    "en": "Tour Packages",
    "ar": "الرحلات السياحية",
    "emoji": "🗺️"
  },
  {
    "id": "sc104",
    "group": "travel",
    "en": "Hotels & Stays",
    "ar": "الفنادق والإقامة",
    "emoji": "🏨"
  },
  {
    "id": "sc105",
    "group": "travel",
    "en": "Van & Group Transport",
    "ar": "النقل الجماعي",
    "emoji": "🚐"
  },
  {
    "id": "sc106",
    "group": "travel",
    "en": "Hajj & Umrah Services",
    "ar": "خدمات الحج والعمرة",
    "emoji": "🕋"
  },
  {
    "id": "sc107",
    "group": "travel",
    "en": "Flights",
    "ar": "الرحلات الجوية",
    "emoji": "✈️"
  },
  {
    "id": "sc108",
    "group": "travel",
    "en": "Train Tickets",
    "ar": "تذاكر القطارات",
    "emoji": "🚆"
  },
  {
    "id": "sc109",
    "group": "travel",
    "en": "Freight & Logistics",
    "ar": "الشحن والخدمات اللوجستية",
    "emoji": "🚛"
  }
];
export function subcategoriesFor(group:SaudiGroupId):SaudiSubcategory[]{
  return saudiSubcategories.filter(s=>s.group===group);
}
export function isSaudiSubcategory(value:unknown):value is string {
  return typeof value==="string"&&saudiSubcategories.some(s=>s.id===value);
}
// Existing verified vendors currently have an 8-category primary classification.
// Do not guess a product's subcategory from the vendor category.
export function groupForLegacyCategory(category:string):SaudiGroupId|null {
  if(category==="Wholesale")return "b2b";
  if(category==="Services")return "service";
  if(["Grocery","Fashion","Food","Electronics","Home","Beauty"].includes(category))return "b2c";
  return null;
}
export function matchesSaudiCategory(
 product:{category:string;subcategoryId?:string|null},
 group:SaudiGroupId|null, subcategoryId:string|null
):boolean{
 if(subcategoryId){
   // A specific subcategory is an exact product property, not an imprecise
   // vendor-level inference. Unknown historical records must NOT be mislabeled.
   const sub=saudiSubcategories.find(s=>s.id===subcategoryId);
   return !!sub&&(!group||sub.group===group)&&product.subcategoryId===subcategoryId;
 }
 if(!group)return true;
 const explicit=product.subcategoryId&&saudiSubcategories.find(s=>s.id===product.subcategoryId);
 return explicit?explicit.group===group:groupForLegacyCategory(product.category)===group;
}
