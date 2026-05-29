export const productModel = {
  id: "",
  name: "",
  description: "",
  category: "",
  basePrice: 0,
  image: "",
  active: true,
  variants: [],
  variantIds: [],
  modifierGroupIds: [],
  metadata: {},
};

export const productVariantModel = {
  id: "",
  productId: "",
  name: "",
  price: 0,
  active: true,
  sortOrder: 0,
  modifierGroupIds: [],
  metadata: {},
};

export const modifierGroupModel = {
  id: "",
  name: "",
  selectionType: "single",
  required: false,
  minSelections: 0,
  maxSelections: 1,
  options: [],
  optionIds: [],
  appliesToProductIds: [],
  sortOrder: 0,
  metadata: {},
};

export const modifierOptionModel = {
  id: "",
  modifierGroupId: "",
  name: "",
  priceAdjustment: 0,
  priceDelta: 0,
  active: true,
  sortOrder: 0,
  metadata: {},
};

export const customerAccountModel = {
  id: "",
  name: "",
  email: "",
  phone: "",
  preferences: {},
  createdAt: "",
};

export const loyaltyProfileModel = {
  id: "",
  customerId: "",
  pointsBalance: 0,
  visitCount: 0,
  tier: "",
  rewards: [],
};

export const orderHistoryModel = {
  id: "",
  customerId: "",
  lineItems: [],
  subtotal: 0,
  tax: 0,
  total: 0,
  status: "",
  placedAt: "",
};

export const adminDataCollections = {
  products: productModel,
  productVariants: productVariantModel,
  modifierGroups: modifierGroupModel,
  modifierOptions: modifierOptionModel,
  customerAccounts: customerAccountModel,
  loyaltyProfiles: loyaltyProfileModel,
  orderHistory: orderHistoryModel,
};
