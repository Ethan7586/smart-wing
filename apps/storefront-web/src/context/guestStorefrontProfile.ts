import type { UserProfile } from '../types';

export function guestStorefrontProfile(source: UserProfile): UserProfile {
  return {
    ...source,
    id: 'guest',
    employeeId: '未登录',
    name: '访客',
    avatar: '',
    phone: '未绑定',
    jobTitle: '访客预览',
    department: '未登录',
    welfareBalance: 0,
    mealBalance: 0,
    couponCount: 0,
    assuranceLevel: 'account',
    phoneVerified: false,
    paymentEligible: false,
  };
}
