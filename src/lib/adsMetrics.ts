export const FACEBOOK_FORM_LEAD_ACTION_KEYS = [
  'form_leads',
  'leadgen.other',
  'leadgen_grouped',
  'onsite_conversion.lead_grouped',
] as const;

export const getFacebookFormLeadsFromData = (data: any) => {
  for (const key of FACEBOOK_FORM_LEAD_ACTION_KEYS) {
    const value = Number(data?.[key]);
    if (value > 0) return value;
  }
  return 0;
};

export const getExplicitLeadFieldsFromData = (data: any) =>
  getFacebookFormLeadsFromData(data) ||
  Number(data?.leads) ||
  Number(data?.website_leads) ||
  Number(data?.offsite_conversion) ||
  Number(data?.offsite_conversion_fb_pixel_lead) ||
  0;

export const getLeadsFromData = (data: any) =>
  Number(data?.leads) ||
  getFacebookFormLeadsFromData(data) ||
  Number(data?.conversions) ||
  Number(data?.website_leads) ||
  Number(data?.offsite_conversion) ||
  Number(data?.offsite_conversion_fb_pixel_lead) ||
  0;