export type DemoCategory = {
  id: string;
  name: string;
  nameKm: string;
  nameEn: string;
  nameZh: string;
  slug: string;
  parentId: string | null;
  imageUrl: string;
  isActive: number;
};

export type DemoProduct = {
  id: string;
  code: string;
  categoryId: string;
  name: string;
  nameKm: string;
  nameEn: string;
  nameZh: string;
  description: string;
  priceCents: number;
  unit: string;
  portions: never[];
  modifierGroups: never[];
  imageUrl: string;
  isFeatured: number;
  isAvailable: number;
};

type ProductSpec = [km: string, en: string, zh: string, price: number];

const images = {
  khmer:
    "https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=900&q=85",
  rice: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=900&q=85",
  noodles:
    "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=85",
  soup: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=85",
  curry:
    "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=85",
  grill:
    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=900&q=85",
  appetizer:
    "https://images.unsplash.com/photo-1541014741259-de529411b96a?auto=format&fit=crop&w=900&q=85",
  softDrink:
    "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=85",
  beer: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=85",
  wine: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=900&q=85",
  redWine:
    "https://images.unsplash.com/photo-1516594915697-87eb3b1c14ea?auto=format&fit=crop&w=900&q=85",
  whiteWine:
    "https://images.unsplash.com/photo-1566754436893-98224ee05be4?auto=format&fit=crop&w=900&q=85",
  coffee:
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85",
};

const category = (
  id: string,
  km: string,
  en: string,
  zh: string,
  imageUrl: string,
  parentId: string | null = null,
): DemoCategory => ({
  id,
  name: km,
  nameKm: km,
  nameEn: en,
  nameZh: zh,
  slug: id.replace(/^cat_/, "").replaceAll("_", "-"),
  parentId,
  imageUrl,
  isActive: 1,
});

const categories: DemoCategory[] = [
  category(
    "cat_khmer_food",
    "ម្ហូបខ្មែរ",
    "Khmer Food",
    "柬埔寨美食",
    images.khmer,
  ),
  category(
    "cat_rice",
    "បាយ",
    "Rice Dishes",
    "米饭",
    images.rice,
    "cat_khmer_food",
  ),
  category(
    "cat_noodles",
    "មី និងគុយទាវ",
    "Noodles",
    "面食",
    images.noodles,
    "cat_khmer_food",
  ),
  category(
    "cat_soups",
    "សម្ល និងស៊ុប",
    "Soups",
    "汤类",
    images.soup,
    "cat_khmer_food",
  ),
  category(
    "cat_curries",
    "ការី",
    "Curries",
    "咖喱",
    images.curry,
    "cat_khmer_food",
  ),
  category(
    "cat_grills",
    "អាំង និងចៀន",
    "Grills & Fried",
    "烧烤煎炸",
    images.grill,
    "cat_khmer_food",
  ),
  category(
    "cat_appetizers",
    "ម្ហូបសម្រន់",
    "Appetizers",
    "小吃",
    images.appetizer,
    "cat_khmer_food",
  ),
  category(
    "cat_soft_drinks",
    "ភេសជ្ជៈ",
    "Soft Drinks",
    "软饮",
    images.softDrink,
  ),
  category("cat_beer", "ស្រាបៀរ", "Beer", "啤酒", images.beer),
  category("cat_wine", "ស្រាទំពាំងបាយជូរ", "Wine", "葡萄酒", images.wine),
  category(
    "cat_red_wine",
    "ស្រាក្រហម",
    "Red Wine",
    "红葡萄酒",
    images.redWine,
    "cat_wine",
  ),
  category(
    "cat_white_wine",
    "ស្រាស",
    "White Wine",
    "白葡萄酒",
    images.whiteWine,
    "cat_wine",
  ),
  category("cat_coffee", "កាហ្វេ", "Coffee", "咖啡", images.coffee),
];

const groups: Array<{
  categoryId: string;
  prefix: string;
  description: string;
  unit: string;
  imageUrl: string;
  items: ProductSpec[];
}> = [
  {
    categoryId: "cat_rice",
    prefix: "RICE",
    description: "A comforting Cambodian rice dish prepared to order.",
    unit: "plate",
    imageUrl: images.rice,
    items: [
      ["បាយសាច់ជ្រូក", "Pork and Rice", "猪肉饭", 12000],
      ["បាយសាច់មាន់", "Chicken and Rice", "鸡肉饭", 12000],
      ["បាយសាច់គោឡុកឡាក់", "Beef Lok Lak Rice", "柬式摇牛肉饭", 18000],
      ["បាយឆាគ្រឿងសមុទ្រ", "Seafood Fried Rice", "海鲜炒饭", 18000],
      ["បាយឆាសាច់គោ", "Beef Fried Rice", "牛肉炒饭", 16000],
      ["បាយឆាសាច់មាន់", "Chicken Fried Rice", "鸡肉炒饭", 14000],
      ["បាយឆាបន្លែ", "Vegetable Fried Rice", "蔬菜炒饭", 12000],
      ["បាយឆាម្នាស់", "Pineapple Fried Rice", "菠萝炒饭", 15000],
      ["បាយសាច់ជ្រូកខ្វៃ", "Roast Pork Rice", "烧猪肉饭", 16000],
      ["បាយមាន់ហៃណាំ", "Hainanese Chicken Rice", "海南鸡饭", 16000],
    ],
  },
  {
    categoryId: "cat_noodles",
    prefix: "NOODLE",
    description: "Fresh noodles with aromatic Khmer herbs and broth.",
    unit: "bowl",
    imageUrl: images.noodles,
    items: [
      ["នំបញ្ចុកសម្លខ្មែរ", "Khmer Nom Banh Chok", "高棉鱼汤米线", 10000],
      ["នំបញ្ចុកសម្លការី", "Curry Nom Banh Chok", "咖喱米线", 12000],
      ["គុយទាវសាច់គោ", "Beef Kuy Teav", "牛肉粿条汤", 14000],
      ["គុយទាវសាច់ជ្រូក", "Pork Kuy Teav", "猪肉粿条汤", 12000],
      ["គុយទាវគ្រឿងសមុទ្រ", "Seafood Kuy Teav", "海鲜粿条汤", 18000],
      ["មីឆាសាច់គោ", "Beef Fried Noodles", "牛肉炒面", 16000],
      ["មីឆាសាច់មាន់", "Chicken Fried Noodles", "鸡肉炒面", 14000],
      ["មីឆាគ្រឿងសមុទ្រ", "Seafood Fried Noodles", "海鲜炒面", 18000],
      ["មីកាតាំងសាច់គោ", "Beef Mee Katang", "牛肉广式炒面", 17000],
      ["លតឆាសាច់គោ", "Beef Lort Cha", "牛肉炒短粉", 16000],
    ],
  },
  {
    categoryId: "cat_soups",
    prefix: "SOUP",
    description: "Traditional Khmer soup made with fresh local ingredients.",
    unit: "bowl",
    imageUrl: images.soup,
    items: [
      ["សម្លម្ជូរគ្រឿងត្រី", "Sour Fish Soup", "酸味鱼汤", 22000],
      ["សម្លកកូរ", "Samlor Korko", "高棉杂蔬汤", 22000],
      ["សម្លម្ជូរយួន", "Samlor Machu Youn", "越式酸汤", 22000],
      ["ស្ងោរជ្រក់សាច់មាន់", "Lime Chicken Soup", "青柠鸡汤", 24000],
      ["ស៊ុបគោ", "Khmer Beef Soup", "高棉牛肉汤", 25000],
      ["ស៊ុបមាន់", "Khmer Chicken Soup", "高棉鸡汤", 22000],
      ["សម្លប្រហើរ", "Samlor Proher", "香草鱼丸汤", 22000],
      ["សម្លម្ជូរត្រកួន", "Water Spinach Sour Soup", "空心菜酸汤", 20000],
    ],
  },
  {
    categoryId: "cat_curries",
    prefix: "CURRY",
    description: "Slow-cooked Cambodian curry served with steamed rice.",
    unit: "bowl",
    imageUrl: images.curry,
    items: [
      ["ការីមាន់", "Khmer Chicken Curry", "高棉鸡肉咖喱", 22000],
      ["ការីសាច់គោ", "Khmer Beef Curry", "高棉牛肉咖喱", 26000],
      ["ការីសាច់ជ្រូក", "Khmer Pork Curry", "高棉猪肉咖喱", 22000],
      ["ការីបន្លែ", "Khmer Vegetable Curry", "高棉蔬菜咖喱", 18000],
      ["អាម៉ុកត្រី", "Fish Amok", "阿莫克鱼", 26000],
      ["អាម៉ុកមាន់", "Chicken Amok", "阿莫克鸡", 24000],
      ["ខគោ", "Khmer Braised Beef", "高棉红烧牛肉", 26000],
      ["ខជើងជ្រូក", "Braised Pork Leg", "红烧猪脚", 24000],
    ],
  },
  {
    categoryId: "cat_grills",
    prefix: "GRILL",
    description: "Char-grilled or wok-fried with a savoury Khmer marinade.",
    unit: "plate",
    imageUrl: images.grill,
    items: [
      [
        "សាច់គោអាំងទឹកប្រហុក",
        "Grilled Beef with Prahok",
        "烤牛肉配鱼酱",
        28000,
      ],
      ["មាន់អាំង", "Khmer Grilled Chicken", "高棉烤鸡", 26000],
      ["ជ្រូកអាំង", "Grilled Pork", "烤猪肉", 24000],
      ["ត្រីអាំងអំបិលម្ទេស", "Salt Chilli Grilled Fish", "椒盐烤鱼", 32000],
      ["បង្គាអាំង", "Grilled Prawns", "烤大虾", 36000],
      ["មឹកអាំង", "Grilled Squid", "烤鱿鱼", 32000],
      ["សាច់គោឡុកឡាក់", "Beef Lok Lak", "柬式摇牛肉", 28000],
      ["ឆាក្តៅសាច់មាន់", "Spicy Wok Chicken", "香辣炒鸡", 24000],
      ["ឆាគ្រឿងសាច់ជ្រូក", "Kroeung Fried Pork", "香茅炒猪肉", 24000],
      ["ត្រីចៀនទឹកត្រី", "Fried Fish with Fish Sauce", "鱼露炸鱼", 32000],
    ],
  },
  {
    categoryId: "cat_appetizers",
    prefix: "STARTER",
    description: "A shareable Cambodian starter or light bite.",
    unit: "plate",
    imageUrl: images.appetizer,
    items: [
      ["ញាំស្វាយ", "Green Mango Salad", "青芒果沙拉", 14000],
      ["ញាំត្រយ៉ូងចេក", "Banana Blossom Salad", "香蕉花沙拉", 16000],
      ["ញាំសាច់គោ", "Khmer Beef Salad", "高棉牛肉沙拉", 20000],
      ["ណែមសាច់ត្រី", "Khmer Fish Spring Rolls", "高棉鱼春卷", 14000],
      ["ណែមបន្លែ", "Vegetable Spring Rolls", "蔬菜春卷", 12000],
      ["ពោតចៀន", "Crispy Fried Corn", "香脆炸玉米", 10000],
      ["តៅហ៊ូចៀន", "Crispy Tofu", "香脆豆腐", 12000],
      ["ស្លាបមាន់បំពង", "Crispy Chicken Wings", "香脆鸡翅", 18000],
      ["ដំឡូងបារាំងបំពង", "French Fries", "炸薯条", 10000],
    ],
  },
  {
    categoryId: "cat_soft_drinks",
    prefix: "SOFT",
    description: "Served chilled.",
    unit: "bottle",
    imageUrl: images.softDrink,
    items: [
      ["ទឹកបរិសុទ្ធគូលែន 500មល", "Kulen Water 500ml", "库伦水 500毫升", 3000],
      ["ទឹកបរិសុទ្ធគូលែន 1.5ល", "Kulen Water 1.5L", "库伦水 1.5升", 5000],
      [
        "ទឹកបរិសុទ្ធវីតាល់ 500មល",
        "Vital Water 500ml",
        "Vital 饮用水 500毫升",
        3000,
      ],
      [
        "ទឹកបរិសុទ្ធអរុណា 500មល",
        "Aruna Water 500ml",
        "Aruna 饮用水 500毫升",
        3000,
      ],
      ["កូកាកូឡា", "Coca-Cola", "可口可乐", 5000],
      ["កូកាកូឡា គ្មានស្ករ", "Coca-Cola Zero", "零度可口可乐", 5000],
      ["ហ្វាន់តា ទឹកក្រូច", "Fanta Orange", "芬达橙味", 5000],
      ["ហ្វាន់តា ស្ត្របឺរី", "Fanta Strawberry", "芬达草莓味", 5000],
      ["ស្ព្រៃត៍", "Sprite", "雪碧", 5000],
      ["ប៉ិបស៊ី", "Pepsi", "百事可乐", 5000],
      ["ប៉ិបស៊ី គ្មានស្ករ", "Pepsi Zero", "无糖百事可乐", 5000],
      ["សេវេនអាប់", "7UP", "七喜", 5000],
      ["មីរីនដា ទឹកក្រូច", "Mirinda Orange", "美年达橙味", 5000],
      ["ស្ទីង ក្រហម", "Sting Red", "红色 Sting 能量饮料", 6000],
      ["វើក", "Wurkz Energy Drink", "Wurkz 能量饮料", 5000],
      ["រ៉េដប៊ុល", "Red Bull", "红牛", 7000],
      ["តែបៃតងអ៊ីឈីតាន់", "Ichitan Green Tea", "一茶园绿茶", 6000],
      ["ទឹកដូងស្រស់", "Fresh Coconut Water", "鲜椰子水", 8000],
    ],
  },
  {
    categoryId: "cat_beer",
    prefix: "BEER",
    description: "Cambodian and international beer served ice cold.",
    unit: "each",
    imageUrl: images.beer,
    items: [
      ["ស្រាបៀរអង្គរ កំប៉ុង", "Angkor Beer Can", "吴哥啤酒（罐）", 5000],
      ["ស្រាបៀរអង្គរ ដប", "Angkor Beer Bottle", "吴哥啤酒（瓶）", 6000],
      ["ស្រាបៀរកម្ពុជា កំប៉ុង", "Cambodia Beer Can", "柬埔寨啤酒（罐）", 5000],
      ["ស្រាបៀរកម្ពុជា ដប", "Cambodia Beer Bottle", "柬埔寨啤酒（瓶）", 6000],
      [
        "ស្រាបៀរហ្គាន់ស៍បឺគ កំប៉ុង",
        "Ganzberg Beer Can",
        "甘兹堡啤酒（罐）",
        5000,
      ],
      [
        "ស្រាបៀរហ្គាន់ស៍បឺគ ដប",
        "Ganzberg Beer Bottle",
        "甘兹堡啤酒（瓶）",
        6000,
      ],
      ["ស្រាបៀរគ្រុឌ កំប៉ុង", "Krud Beer Can", "Krud 啤酒（罐）", 5000],
      ["ស្រាបៀរគ្រុឌ ដប", "Krud Beer Bottle", "Krud 啤酒（瓶）", 6000],
      ["ស្រាបៀរហនុមាន កំប៉ុង", "Hanuman Beer Can", "哈努曼啤酒（罐）", 5000],
      ["ស្រាបៀរហនុមាន ដប", "Hanuman Beer Bottle", "哈努曼啤酒（瓶）", 6000],
      ["ស្រាបៀរអាន់ឆ័រ កំប៉ុង", "Anchor Beer Can", "Anchor 啤酒（罐）", 5000],
      ["ស្រាបៀរអាន់ឆ័រ ដប", "Anchor Beer Bottle", "Anchor 啤酒（瓶）", 6000],
      ["ស្រាបៀរ ABC កំប៉ុង", "ABC Stout Can", "ABC 黑啤（罐）", 8000],
      ["ស្រាបៀរ ABC ដប", "ABC Stout Bottle", "ABC 黑啤（瓶）", 9000],
      ["ស្រាបៀរថៃហ្គ័រ កំប៉ុង", "Tiger Beer Can", "虎牌啤酒（罐）", 6000],
      ["ស្រាបៀរថៃហ្គ័រ ដប", "Tiger Beer Bottle", "虎牌啤酒（瓶）", 7000],
    ],
  },
  {
    categoryId: "cat_red_wine",
    prefix: "RED",
    description: "A glass or bottle of carefully selected red wine.",
    unit: "glass",
    imageUrl: images.redWine,
    items: [
      ["កាបឺណេ សូវីញ៉ុង", "Cabernet Sauvignon", "赤霞珠红葡萄酒", 24000],
      ["មឺឡូ", "Merlot", "梅洛红葡萄酒", 22000],
      ["ស៊ីរ៉ា", "Shiraz", "西拉红葡萄酒", 24000],
      ["ពីណូ ណ័រ", "Pinot Noir", "黑皮诺红葡萄酒", 26000],
      ["ម៉ាល់បិច", "Malbec", "马尔贝克红葡萄酒", 24000],
      ["តេមប្រានីយ៉ូ", "Tempranillo", "丹魄红葡萄酒", 23000],
      ["ក្រហមហោស៍", "House Red Wine", "本店红葡萄酒", 18000],
    ],
  },
  {
    categoryId: "cat_white_wine",
    prefix: "WHITE",
    description: "A crisp white wine served at the perfect temperature.",
    unit: "glass",
    imageUrl: images.whiteWine,
    items: [
      ["សូវីញ៉ុង ប្លង់", "Sauvignon Blanc", "长相思白葡萄酒", 23000],
      ["ឆាដូណេ", "Chardonnay", "霞多丽白葡萄酒", 24000],
      ["ពីណូ ហ្គ្រីជីអូ", "Pinot Grigio", "灰皮诺白葡萄酒", 23000],
      ["រីស្លីង", "Riesling", "雷司令白葡萄酒", 24000],
      ["មូស្កាតូ", "Moscato", "莫斯卡托甜白葡萄酒", 22000],
      ["សេនីន ប្លង់", "Chenin Blanc", "白诗南白葡萄酒", 22000],
      ["សហោស៍", "House White Wine", "本店白葡萄酒", 18000],
    ],
  },
  {
    categoryId: "cat_coffee",
    prefix: "COFFEE",
    description: "Freshly brewed coffee made to order.",
    unit: "cup",
    imageUrl: images.coffee,
    items: [
      ["កាហ្វេខ្មៅក្តៅ", "Hot Khmer Black Coffee", "热高棉黑咖啡", 6000],
      ["កាហ្វេទឹកដោះគោក្តៅ", "Hot Khmer Milk Coffee", "热高棉奶咖啡", 7000],
      ["កាហ្វេខ្មៅទឹកកក", "Iced Khmer Black Coffee", "冰高棉黑咖啡", 7000],
      ["កាហ្វេទឹកដោះគោទឹកកក", "Iced Khmer Milk Coffee", "冰高棉奶咖啡", 8000],
      ["អេសប្រេសសូ", "Espresso", "意式浓缩", 7000],
      ["អេសប្រេសសូពីរដង", "Double Espresso", "双份意式浓缩", 9000],
      ["អាមេរិកាណូក្តៅ", "Hot Americano", "热美式咖啡", 8000],
      ["អាមេរិកាណូទឹកកក", "Iced Americano", "冰美式咖啡", 9000],
      ["ឡាតេក្តៅ", "Hot Latte", "热拿铁", 10000],
      ["ឡាតេទឹកកក", "Iced Latte", "冰拿铁", 11000],
      ["កាពូឈីណូក្តៅ", "Hot Cappuccino", "热卡布奇诺", 10000],
      ["កាពូឈីណូទឹកកក", "Iced Cappuccino", "冰卡布奇诺", 11000],
      ["ម៉ូកាក្តៅ", "Hot Mocha", "热摩卡", 11000],
      ["ម៉ូកាទឹកកក", "Iced Mocha", "冰摩卡", 12000],
      ["ការ៉ាមែល ម៉ាគីអាតូ", "Caramel Macchiato", "焦糖玛奇朵", 13000],
      ["វ៉ានីឡាឡាតេ", "Vanilla Latte", "香草拿铁", 12000],
      ["កាហ្វេទឹកដូង", "Coconut Coffee", "椰子咖啡", 12000],
    ],
  },
];

const products: DemoProduct[] = groups.flatMap((group) =>
  group.items.map(([nameKm, nameEn, nameZh, priceCents], index) => ({
    id: `demo_${group.prefix.toLowerCase()}_${String(index + 1).padStart(2, "0")}`,
    code: `${group.prefix}-${String(index + 1).padStart(3, "0")}`,
    categoryId: group.categoryId,
    name: nameKm,
    nameKm,
    nameEn,
    nameZh,
    description: group.description,
    priceCents,
    unit: group.unit,
    portions: [],
    modifierGroups: [],
    imageUrl: group.imageUrl,
    isFeatured: index === 0 ? 1 : 0,
    isAvailable: 1,
  })),
);

export const demoCatalog = {
  business: {
    name: "Angkor Kitchen",
    logoUrl: "",
    logoMediaId: "",
    slug: "angkor-kitchen",
    tagline: "Authentic Khmer flavours, served with heart.",
    description:
      "Traditional Cambodian food, local drinks and café favourites in one menu.",
    phone: "+855 12 345 678",
    contactNumbers: [
      { label: "Reservations", number: "+855 12 345 678" },
      { label: "Delivery", number: "+855 98 765 432" },
    ],
    businessHours: Array.from({ length: 7 }, (_, day) => ({
      day,
      enabled: true,
      open: day === 0 ? "09:00" : "07:00",
      close: day === 0 ? "21:00" : "22:00",
    })),
    email: "hello@angkorkitchen.example",
    websiteUrl: "https://example.com",
    socialLinks: [
      { platform: "Facebook", url: "https://facebook.com" },
      { platform: "Instagram", url: "https://instagram.com" },
    ],
    locations: [
      {
        label: "Phnom Penh branch",
        address: "Street 214, Phnom Penh, Cambodia",
        mapUrl: "https://maps.google.com/?q=Phnom+Penh",
        showInMenu: true,
      },
    ],
    mapUrl: "https://maps.google.com/?q=Phnom+Penh",
    address: "Street 214, Phnom Penh, Cambodia",
    currency: "KHR",
    locale: "km",
    enableEn: true,
    enableZh: true,
    themeColor: "#de3c2f",
  },
  categories,
  products,
  banners: [
    {
      id: "ban_angkor_1",
      title: "រសជាតិខ្មែរ ពីផ្ទះបាយយើង",
      subtitle: "Authentic Khmer favourites, freshly prepared every day.",
      imageUrl:
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=85",
      detailText: "",
      ctaLabel: "",
      ctaUrl: "",
      isActive: 1,
    },
    {
      id: "ban_angkor_2",
      title: "ម្ហូបខ្មែរឆ្ងាញ់ៗ សម្រាប់ចែករំលែក",
      subtitle: "Share traditional Cambodian dishes with family and friends.",
      imageUrl:
        "https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=1400&q=85",
      detailText: "",
      ctaLabel: "",
      ctaUrl: "",
      isActive: 1,
    },
    {
      id: "ban_angkor_3",
      title: "កាហ្វេស្រស់ រៀងរាល់ថ្ងៃ",
      subtitle: "Fresh coffee and cool drinks from morning until late.",
      imageUrl:
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1400&q=85",
      detailText: "",
      ctaLabel: "",
      ctaUrl: "",
      isActive: 1,
    },
  ],
};

export const demoProductCount = products.length;
