export interface CountryConfig {
  name: string;
  currency: string;
  dialCode: string;
}

export const COUNTRIES_LIST: CountryConfig[] = [
  { name: 'الأردن', currency: 'دينار', dialCode: '962' },
  { name: 'السعودية', currency: 'ريال', dialCode: '966' },
  { name: 'الإمارات', currency: 'درهم', dialCode: '971' },
  { name: 'مصر', currency: 'جنيه', dialCode: '20' },
  { name: 'العراق', currency: 'دينار', dialCode: '964' },
  { name: 'الكويت', currency: 'دينار', dialCode: '965' },
  { name: 'قطر', currency: 'ريال', dialCode: '974' },
  { name: 'البحرين', currency: 'دينار', dialCode: '973' },
  { name: 'عُمان', currency: 'ريال', dialCode: '968' },
  { name: 'فلسطين', currency: 'شيكل', dialCode: '970' },
  { name: 'سوريا', currency: 'ليرة', dialCode: '963' },
  { name: 'لبنان', currency: 'ليرة', dialCode: '961' },
  { name: 'اليمن', currency: 'ريال', dialCode: '967' },
  { name: 'ليبيا', currency: 'دينار', dialCode: '218' },
  { name: 'تونس', currency: 'دينار', dialCode: '216' },
  { name: 'الجزائر', currency: 'دينار', dialCode: '213' },
  { name: 'المغرب', currency: 'درهم', dialCode: '212' },
  { name: 'السودان', currency: 'جنيه', dialCode: '249' },
  { name: 'موريتانيا', currency: 'أوقية', dialCode: '222' },
  { name: 'تركيا', currency: 'ليرة', dialCode: '90' },
  { name: 'الولايات المتحدة', currency: 'دولار', dialCode: '1' },
  { name: 'المملكة المتحدة', currency: 'جنيه إسترليني', dialCode: '44' },
  { name: 'كندا', currency: 'دولار', dialCode: '1' },
  { name: 'ألمانيا', currency: 'يورو', dialCode: '49' },
  { name: 'فرنسا', currency: 'يورو', dialCode: '33' },
  { name: 'إيطاليا', currency: 'يورو', dialCode: '39' },
  { name: 'إسبانيا', currency: 'يورو', dialCode: '34' },
  { name: 'السويد', currency: 'كرونة', dialCode: '46' },
  { name: 'النرويج', currency: 'كرونة', dialCode: '47' },
  { name: 'الدنمارك', currency: 'كرونة', dialCode: '45' },
  { name: 'هولندا', currency: 'يورو', dialCode: '31' },
  { name: 'بلجيكا', currency: 'يورو', dialCode: '32' },
  { name: 'سويسرا', currency: 'فرنك', dialCode: '41' },
  { name: 'النمسا', currency: 'يورو', dialCode: '43' },
  { name: 'أستراليا', currency: 'دولار', dialCode: '61' },
  { name: 'ماليزيا', currency: 'رينغيت', dialCode: '60' },
  { name: 'إندونيسيا', currency: 'روبية', dialCode: '62' },
  { name: 'الهند', currency: 'روبية', dialCode: '91' },
  { name: 'باكستان', currency: 'روبية', dialCode: '92' }
];
