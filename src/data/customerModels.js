export const customerProfileModel = {
  id: "",
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
};

export const customerAuthRecordModel = {
  customerId: "",
  email: "",
  password: "",
  createdAt: "",
};

export const customerAccountExtensionModel = {
  customerId: "",
  orderHistory: [],
  favoriteOrders: [],
  loyaltyPoints: 0,
  rewards: [],
  promotions: [],
  cloverCustomerId: "",
  metadata: {},
};

export const customerDataCollections = {
  customerProfiles: customerProfileModel,
  customerAuthRecords: customerAuthRecordModel,
  customerAccountExtensions: customerAccountExtensionModel,
};
