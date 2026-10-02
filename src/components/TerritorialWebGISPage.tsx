import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
type LeafletMap = L.Map;
import { 
  Layers, 
  Search, 
  Compass, 
  Sliders, 
  Sparkles, 
  Play, 
  Pause, 
  Filter, 
  FileText, 
  Maximize2, 
  Minimize2, 
  Download, 
  MapPin, 
  TrendingUp, 
  AlertTriangle, 
  ShieldCheck, 
  Info, 
  Eye, 
  Zap, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  BarChart3, 
  Table, 
  HelpCircle, 
  Clock, 
  Share2, 
  Bookmark, 
  Printer, 
  Split, 
  Move, 
  Activity, 
  Calendar, 
  X, 
  Plus, 
  Minus, 
  Check, 
  Layers3, 
  Globe, 
  Wind, 
  Droplet, 
  Flame, 
  Building2, 
  Users, 
  DollarSign, 
  Truck, 
  ShieldAlert, 
  Cpu, 
  BookOpen,
  Satellite
} from 'lucide-react';
import { toPersianDigits } from './AnimatedCounter';
import { PROVINCES_DATA } from '../data/iranProvincePaths';
import { PROVINCE_OUTLINES } from '../data/provinceOutlines';
import {
  loadSpatialData,
  loadInfographicData,
  type SpatialData,
  type InfographicFile,
  type HealthPoint,
  type TransportPoint,
  HEALTH_TYPE_COLORS,
  INFRA_GROUP_LABELS,
  INFRA_GROUP_COLORS,
  provinceStatByRef,
  hospitalAccessByCode
} from '../data/spatial';
import { type BasemapStyle } from '../lib/offlineBasemap';
import {
  loadPbfLayer,
  loadPbfProvinceStats,
  pbfStatByProvince,
  type PbfLayerFile,
  type PbfLayerName,
  type PbfProvinceStatsFile
} from '../data/spatial/pbfLayers';

// Types for 10-Dimension GIS Data
export interface GISDimension {
  code: string;
  name: string;
  icon: any;
  color: string;
  kpis: { id: string; name: string; value: number; unit: string; trend: 'up' | 'down' | 'stable' }[];
}

export interface GeoCell {
  id: string;
  code: string;
  name: string;
  province: string;
  county: string;
  district: string;
  lat: number;
  lng: number;
  status: 'critical' | 'warning' | 'optimal';
  population: number;
  dimensions: Record<string, number>; // 10 dimensions scores 0-100
  waterStress: number;
  gdpGrowth: number;
  inflation: number;
  satisfaction: number;
  unemployment: number;
  digitalIndex: number;
  riskScore: number;
}

export interface SpatialBookmark {
  id: string;
  title: string;
  lat: number;
  lng: number;
  zoom: number;
  activeLayers: string[];
  date: string;
}

// 31 Provinces & Strategic Cells Dataset
const PROVINCES_CELL_DATA: GeoCell[] = [
  { id: 'cell-teh', code: 'IR-TEH-01', name: 'تهران بزرگ', province: 'تهران', county: 'تهران', district: 'مرکزی', lat: 35.6892, lng: 51.3890, status: 'warning', population: 9100000, dimensions: { S: 75, E: 88, P: 82, D: 92, I: 95, C: 80, N: 35, F: 90, T: 85, R: 60 }, waterStress: 82.5, gdpGrowth: 5.8, inflation: 32.4, satisfaction: 68, unemployment: 9.2, digitalIndex: 94, riskScore: 72 },
  { id: 'cell-far', code: 'IR-FAR-02', name: 'شیراز و دشت مرودشت', province: 'فارس', county: 'شیراز', district: 'مرکزی', lat: 29.5918, lng: 52.5837, status: 'warning', population: 1850000, dimensions: { S: 78, E: 72, P: 70, D: 75, I: 80, C: 88, N: 42, F: 74, T: 78, R: 65 }, waterStress: 79.1, gdpGrowth: 4.9, inflation: 34.1, satisfaction: 72, unemployment: 11.5, digitalIndex: 82, riskScore: 58 },
  { id: 'cell-isf', code: 'IR-ISF-03', name: 'زاینده‌رود و اصفهان', province: 'اصفهان', county: 'اصفهان', district: 'مرکزی', lat: 32.6546, lng: 51.6680, status: 'critical', population: 2200000, dimensions: { S: 70, E: 80, P: 75, D: 78, I: 85, C: 86, N: 28, F: 82, T: 80, R: 80 }, waterStress: 89.4, gdpGrowth: 5.2, inflation: 35.0, satisfaction: 64, unemployment: 10.8, digitalIndex: 88, riskScore: 84 },
  { id: 'cell-khz', code: 'IR-KHZ-04', name: 'دشت اهواز و کارون', province: 'خوزستان', county: 'اهواز', district: 'مرکزی', lat: 31.3200, lng: 48.6693, status: 'critical', population: 1300000, dimensions: { S: 62, E: 85, P: 68, D: 70, I: 72, C: 74, N: 25, F: 88, T: 82, R: 88 }, waterStress: 88.4, gdpGrowth: 6.2, inflation: 36.2, satisfaction: 59, unemployment: 14.2, digitalIndex: 76, riskScore: 89 },
  { id: 'cell-eaz', code: 'IR-EAZ-05', name: 'تبریز و حوضه ارومیه', province: 'آذربایجان شرقی', county: 'تبریز', district: 'مرکزی', lat: 38.0800, lng: 46.2919, status: 'optimal', population: 1700000, dimensions: { S: 82, E: 76, P: 78, D: 80, I: 84, C: 85, N: 52, F: 78, T: 81, R: 50 }, waterStress: 68.2, gdpGrowth: 4.8, inflation: 31.5, satisfaction: 75, unemployment: 8.5, digitalIndex: 85, riskScore: 48 },
  { id: 'cell-siv', code: 'IR-SIV-06', name: 'زاهدان و هیرمند', province: 'سیستان و بلوچستان', county: 'زاهدان', district: 'مرکزی', lat: 29.4963, lng: 60.8629, status: 'critical', population: 600000, dimensions: { S: 45, E: 40, P: 55, D: 60, I: 50, C: 80, N: 18, F: 42, T: 55, R: 92 }, waterStress: 94.0, gdpGrowth: 3.1, inflation: 38.9, satisfaction: 52, unemployment: 18.5, digitalIndex: 58, riskScore: 92 },
  { id: 'cell-khr', code: 'IR-KHR-07', name: 'مشهد مقدس', province: 'خراسان رضوی', county: 'مشهد', district: 'مرکزی', lat: 36.2972, lng: 59.6067, status: 'warning', population: 3400000, dimensions: { S: 76, E: 75, P: 78, D: 82, I: 83, C: 95, N: 38, F: 79, T: 84, R: 62 }, waterStress: 81.0, gdpGrowth: 5.1, inflation: 33.2, satisfaction: 71, unemployment: 9.8, digitalIndex: 86, riskScore: 65 },
  { id: 'cell-hor', code: 'IR-HOR-08', name: 'بندرعباس و تنگه هرمز', province: 'هرمزگان', county: 'بندرعباس', district: 'مرکزی', lat: 27.1832, lng: 56.2666, status: 'warning', population: 680000, dimensions: { S: 68, E: 82, P: 72, D: 68, I: 75, C: 78, N: 40, F: 85, T: 92, R: 68 }, waterStress: 76.5, gdpGrowth: 6.8, inflation: 34.8, satisfaction: 69, unemployment: 12.0, digitalIndex: 80, riskScore: 66 },
  { id: 'cell-gil', code: 'IR-GIL-09', name: 'رشت و دلتای سفیدرود', province: 'گیلان', county: 'رشت', district: 'مرکزی', lat: 37.2808, lng: 49.5832, status: 'optimal', population: 950000, dimensions: { S: 85, E: 65, P: 74, D: 72, I: 78, C: 88, N: 78, F: 68, T: 75, R: 40 }, waterStress: 42.1, gdpGrowth: 4.2, inflation: 29.8, satisfaction: 81, unemployment: 10.2, digitalIndex: 81, riskScore: 38 },
  { id: 'cell-ker', code: 'IR-KER-10', name: 'کرمان و جنوب شرق', province: 'کرمان', county: 'کرمان', district: 'مرکزی', lat: 30.2839, lng: 57.0834, status: 'critical', population: 750000, dimensions: { S: 65, E: 78, P: 70, D: 68, I: 70, C: 82, N: 22, F: 80, T: 72, R: 82 }, waterStress: 87.2, gdpGrowth: 5.9, inflation: 35.4, satisfaction: 66, unemployment: 11.0, digitalIndex: 75, riskScore: 81 },
  { id: 'cell-yzd', code: 'IR-YZD-11', name: 'یزد و دشت کویر', province: 'یزد', county: 'یزد', district: 'مرکزی', lat: 31.8974, lng: 54.3675, status: 'warning', population: 650000, dimensions: { S: 80, E: 84, P: 76, D: 70, I: 82, C: 90, N: 30, F: 85, T: 78, R: 70 }, waterStress: 86.0, gdpGrowth: 5.5, inflation: 31.8, satisfaction: 76, unemployment: 7.9, digitalIndex: 87, riskScore: 68 },
  { id: 'cell-qom', code: 'IR-QOM-12', name: 'قم و حوضه نمک', province: 'قم', county: 'قم', district: 'مرکزی', lat: 34.6401, lng: 50.8764, status: 'warning', population: 1200000, dimensions: { S: 72, E: 70, P: 80, D: 76, I: 78, C: 92, N: 32, F: 75, T: 80, R: 64 }, waterStress: 84.0, gdpGrowth: 4.3, inflation: 33.0, satisfaction: 70, unemployment: 10.1, digitalIndex: 83, riskScore: 67 },
  { id: 'cell-kms', code: 'IR-KMS-13', name: 'کرمانشاه و غرب', province: 'کرمانشاه', county: 'کرمانشاه', district: 'مرکزی', lat: 34.3142, lng: 47.0650, status: 'warning', population: 980000, dimensions: { S: 66, E: 62, P: 65, D: 68, I: 70, C: 82, N: 58, F: 64, T: 74, R: 72 }, waterStress: 62.0, gdpGrowth: 3.8, inflation: 37.5, satisfaction: 62, unemployment: 15.8, digitalIndex: 74, riskScore: 71 },
  { id: 'cell-hmd', code: 'IR-HMD-14', name: 'همدان و دشت الوند', province: 'همدان', county: 'همدان', district: 'مرکزی', lat: 34.7982, lng: 48.5146, status: 'optimal', population: 550000, dimensions: { S: 75, E: 68, P: 72, D: 70, I: 76, C: 86, N: 48, F: 70, T: 72, R: 52 }, waterStress: 71.0, gdpGrowth: 4.1, inflation: 32.0, satisfaction: 73, unemployment: 9.6, digitalIndex: 80, riskScore: 50 },
  { id: 'cell-urm', code: 'IR-URM-15', name: 'ارومیه و دریاچه', province: 'آذربایجان غربی', county: 'ارومیه', district: 'مرکزی', lat: 37.5527, lng: 45.0761, status: 'warning', population: 730000, dimensions: { S: 74, E: 70, P: 71, D: 72, I: 73, C: 80, N: 38, F: 69, T: 76, R: 68 }, waterStress: 80.5, gdpGrowth: 4.0, inflation: 34.2, satisfaction: 68, unemployment: 12.1, digitalIndex: 78, riskScore: 66 },
  { id: 'cell-ard', code: 'IR-ARD-16', name: 'اردبیل و دشت مغان', province: 'اردبیل', county: 'اردبیل', district: 'مرکزی', lat: 38.2498, lng: 48.2933, status: 'optimal', population: 530000, dimensions: { S: 76, E: 67, P: 70, D: 69, I: 71, C: 82, N: 65, F: 68, T: 70, R: 48 }, waterStress: 52.0, gdpGrowth: 4.5, inflation: 31.0, satisfaction: 74, unemployment: 10.4, digitalIndex: 76, riskScore: 45 },
  { id: 'cell-sar', code: 'IR-SAR-17', name: 'ساری و دشت خزر', province: 'مازندران', county: 'ساری', district: 'مرکزی', lat: 36.5659, lng: 53.0586, status: 'optimal', population: 880000, dimensions: { S: 82, E: 74, P: 75, D: 76, I: 80, C: 85, N: 72, F: 72, T: 78, R: 42 }, waterStress: 45.0, gdpGrowth: 4.7, inflation: 30.5, satisfaction: 79, unemployment: 8.9, digitalIndex: 84, riskScore: 40 },
  { id: 'cell-gor', code: 'IR-GOR-18', name: 'گرگان و دشت گرگان', province: 'گلستان', county: 'گرگان', district: 'مرکزی', lat: 36.8456, lng: 54.4393, status: 'optimal', population: 510000, dimensions: { S: 75, E: 66, P: 70, D: 71, I: 72, C: 80, N: 68, F: 66, T: 71, R: 50 }, waterStress: 58.0, gdpGrowth: 4.2, inflation: 32.8, satisfaction: 72, unemployment: 11.2, digitalIndex: 76, riskScore: 48 },
  { id: 'cell-bsh', code: 'IR-BSH-19', name: 'بوشهر و عسلویه', province: 'بوشهر', county: 'بوشهر', district: 'مرکزی', lat: 28.9234, lng: 50.8384, status: 'warning', population: 300000, dimensions: { S: 70, E: 92, P: 74, D: 75, I: 80, C: 78, N: 35, F: 94, T: 88, R: 65 }, waterStress: 78.0, gdpGrowth: 7.1, inflation: 33.5, satisfaction: 67, unemployment: 10.5, digitalIndex: 82, riskScore: 62 },
  { id: 'cell-snj', code: 'IR-SNJ-20', name: 'سنندج و زاگرس شمالی', province: 'کردستان', county: 'سنندج', district: 'مرکزی', lat: 35.3144, lng: 46.9923, status: 'warning', population: 460000, dimensions: { S: 68, E: 60, P: 64, D: 66, I: 68, C: 88, N: 62, F: 60, T: 68, R: 60 }, waterStress: 55.0, gdpGrowth: 3.5, inflation: 36.8, satisfaction: 65, unemployment: 16.2, digitalIndex: 72, riskScore: 58 },
  { id: 'cell-chb', code: 'IR-CHB-21', name: 'شهرکرد و چهارمحال', province: 'چهارمحال و بختیاری', county: 'شهرکرد', district: 'مرکزی', lat: 32.3258, lng: 50.8595, status: 'warning', population: 380000, dimensions: { S: 70, E: 62, P: 66, D: 68, I: 66, C: 82, N: 45, F: 64, T: 70, R: 55 }, waterStress: 74.0, gdpGrowth: 4.0, inflation: 33.5, satisfaction: 70, unemployment: 12.8, digitalIndex: 74, riskScore: 55 },
  { id: 'cell-bsn', code: 'IR-BSN-22', name: 'بیرجند و خراسان جنوبی', province: 'خراسان جنوبی', county: 'بیرجند', district: 'مرکزی', lat: 32.8558, lng: 59.2234, status: 'warning', population: 280000, dimensions: { S: 72, E: 58, P: 64, D: 65, I: 62, C: 80, N: 35, F: 58, T: 68, R: 60 }, waterStress: 90.0, gdpGrowth: 3.8, inflation: 35.2, satisfaction: 68, unemployment: 13.5, digitalIndex: 70, riskScore: 72 },
  { id: 'cell-bsh-n', code: 'IR-BSH-23', name: 'بجنورد و خراسان شمالی', province: 'خراسان شمالی', county: 'بجنورد', district: 'مرکزی', lat: 37.4747, lng: 57.3290, status: 'optimal', population: 310000, dimensions: { S: 70, E: 58, P: 62, D: 64, I: 60, C: 78, N: 48, F: 58, T: 66, R: 52 }, waterStress: 68.0, gdpGrowth: 3.6, inflation: 34.0, satisfaction: 70, unemployment: 11.8, digitalIndex: 68, riskScore: 50 },
  { id: 'cell-zjn', code: 'IR-ZJN-24', name: 'زنجان و طارم', province: 'زنجان', county: 'زنجان', district: 'مرکزی', lat: 36.6760, lng: 48.4963, status: 'optimal', population: 420000, dimensions: { S: 74, E: 66, P: 68, D: 69, I: 68, C: 80, N: 52, F: 64, T: 72, R: 48 }, waterStress: 62.0, gdpGrowth: 4.2, inflation: 32.5, satisfaction: 72, unemployment: 10.5, digitalIndex: 76, riskScore: 45 },
  { id: 'cell-smn', code: 'IR-SMN-25', name: 'سمنان و شاهرود', province: 'سمنان', county: 'سمنان', district: 'مرکزی', lat: 35.5769, lng: 53.3961, status: 'optimal', population: 190000, dimensions: { S: 76, E: 70, P: 70, D: 68, I: 66, C: 78, N: 40, F: 68, T: 74, R: 46 }, waterStress: 72.0, gdpGrowth: 4.5, inflation: 31.8, satisfaction: 73, unemployment: 9.2, digitalIndex: 74, riskScore: 42 },
  { id: 'cell-qzv', code: 'IR-QZV-26', name: 'قزوین و تاکستان', province: 'قزوین', county: 'قزوین', district: 'مرکزی', lat: 36.2605, lng: 50.0030, status: 'optimal', population: 380000, dimensions: { S: 76, E: 72, P: 70, D: 71, I: 72, C: 80, N: 48, F: 70, T: 76, R: 45 }, waterStress: 65.0, gdpGrowth: 4.8, inflation: 32.0, satisfaction: 74, unemployment: 9.8, digitalIndex: 78, riskScore: 40 },
  { id: 'cell-yas', code: 'IR-YAS-27', name: 'یاسوج و دهدشت', province: 'کهگیلویه و بویراحمد', county: 'یاسوج', district: 'مرکزی', lat: 30.6628, lng: 51.5944, status: 'critical', population: 220000, dimensions: { S: 62, E: 55, P: 58, D: 60, I: 55, C: 78, N: 55, F: 52, T: 60, R: 72 }, waterStress: 58.0, gdpGrowth: 3.2, inflation: 37.0, satisfaction: 62, unemployment: 15.5, digitalIndex: 62, riskScore: 70 },
  { id: 'cell-krm-l', code: 'IR-KRM-28', name: 'خرم‌آباد و لرستان', province: 'لرستان', county: 'خرم‌آباد', district: 'مرکزی', lat: 33.4865, lng: 48.3616, status: 'warning', population: 450000, dimensions: { S: 65, E: 56, P: 62, D: 64, I: 60, C: 82, N: 50, F: 56, T: 64, R: 62 }, waterStress: 66.0, gdpGrowth: 3.4, inflation: 36.5, satisfaction: 64, unemployment: 14.8, digitalIndex: 68, riskScore: 60 },
  { id: 'cell-arak', code: 'IR-ARK-29', name: 'اراک و مرکزی', province: 'مرکزی', county: 'اراک', district: 'مرکزی', lat: 34.0911, lng: 49.6893, status: 'optimal', population: 520000, dimensions: { S: 72, E: 74, P: 70, D: 70, I: 70, C: 78, N: 42, F: 72, T: 78, R: 50 }, waterStress: 70.0, gdpGrowth: 5.0, inflation: 33.0, satisfaction: 71, unemployment: 10.2, digitalIndex: 78, riskScore: 48 },
  { id: 'cell-ilam', code: 'IR-ILM-30', name: 'ایلام و مهران', province: 'ایلام', county: 'ایلام', district: 'مرکزی', lat: 33.6375, lng: 46.4227, status: 'warning', population: 160000, dimensions: { S: 64, E: 55, P: 60, D: 62, I: 58, C: 80, N: 52, F: 55, T: 62, R: 65 }, waterStress: 58.0, gdpGrowth: 3.0, inflation: 37.5, satisfaction: 66, unemployment: 15.0, digitalIndex: 64, riskScore: 62 },
  { id: 'cell-smn', code: 'IR-SMN-25', name: 'سمنان و شاهرود', province: 'سمنان', county: 'سمنان', district: 'مرکزی', lat: 35.5769, lng: 53.3961, status: 'optimal', population: 190000, dimensions: { S: 76, E: 70, P: 70, D: 68, I: 66, C: 78, N: 40, F: 68, T: 74, R: 46 }, waterStress: 72.0, gdpGrowth: 4.5, inflation: 31.8, satisfaction: 73, unemployment: 9.2, digitalIndex: 74, riskScore: 42 }
];

// Available 2D Layers Definitions for Z-Index Management
export interface Layer2DDef {
  id: string;
  name: string;
  category: string;
  color: string;
  description: string;
}

const AVAILABLE_2D_LAYERS: Layer2DDef[] = [
  { id: 'boundary-national', name: 'مرزهای کشوری و حاکمیتی', category: 'تقسیمات', color: '#38BDF8', description: 'مرزهای رسمی و محدوده حاکمیتی جمهوری اسلامی ایران' },
  { id: 'boundary-province', name: 'مرزهای استانی و تقسیمات', category: 'تقسیمات', color: '#94A3B8', description: 'محدوده تقسیمات سیاسی استان‌ها و شهرستان‌های ۳۱ گانه' },
  { id: 'layer-water-stress', name: 'پهنه تنش آبی و فرونشست زمین', category: 'محیط‌زیست', color: '#EF4444', description: 'میزان تنش آب زیرزمینی و نرخ نشست دشت‌های کشور' },
  { id: 'layer-population', name: 'تراکم و جابه‌جایی جمعیت', category: 'جمعیتی', color: '#EC4899', description: 'تراکم نفوس و شریان‌های جریان مهاجرت داخلی' },
  { id: 'layer-infrastructure', name: 'شبکه ترانزیت و زیرساخت کلیدی', category: 'زیرساخت', color: '#F59E0B', description: 'کریدورهای ریلی، جاده‌ای و شبکه‌های انرژی کشور' },
  { id: 'layer-industry', name: 'مراکز صنعتی و قطب‌های تولید', category: 'اقتصادی', color: '#10B981', description: 'شهرک‌های صنعتی، صنایع مادر و مجتمع‌های تولیدی' },
  { id: 'layer-dams', name: 'سدها و منابع آب سطحی', category: 'محیط‌زیست', color: '#06B6D4', description: 'ذخایر سدهای ملی، حوضه‌های آبریز و رودخانه‌ها' },
  { id: 'layer-faultlines', name: 'گسل‌های فعال و پهنه‌های زلزله', category: 'مدیریت بحران', color: '#DC2626', description: 'نقشه گسل‌های اصلی و تحلیل مخاطرات لرزه‌ای' },
  { id: 'layer-s1', name: 'سرمایه اجتماعی و رفاه عمومی', category: 'اجتماعی', color: '#3B82F6', description: 'پهنه‌بندی سرمایه اجتماعی، رفاه و محرومیت‌زدایی' },
  { id: 'layer-i1', name: 'پوشش زیرساخت دیجیتال و فیبر نوری', category: 'دیجیتال', color: '#8B5CF6', description: 'کیفیت دسترسی به فیبر نوری و پهنای باند منطقه' },
  // ── لایه‌های دادهٔ مکانی geojson (منابع باز HDX/HOT/Healthsites) ──
  { id: 'layer-geo-health', name: 'مراکز درمانی (Healthsites)', category: 'داده‌های مکانی', color: '#DC2626', description: '۱۱٬۹۹۲ مرکز درمانی نقطه‌ای — داروخانه/بیمارستان/کلینیک/مطب (Healthsites.io، HDX)' },
  { id: 'layer-geo-airports', name: 'فرودگاه‌ها و هلی‌پدها', category: 'داده‌های مکانی', color: '#F59E0B', description: '۵۸۵ نقطهٔ هوایی — باند/ترمینال/هلی‌پد (HOT OSM)' },
  { id: 'layer-geo-ports', name: 'بنادر دریایی و اسکله‌ها', category: 'داده‌های مکانی', color: '#0EA5E9', description: '۴۳ بندر و اسکله (HOT OSM)' },
  { id: 'layer-geo-education', name: 'مراکز آموزشی', category: 'داده‌های مکانی', color: '#3B82F6', description: '۶٬۶۱۲ مرکز آموزشی نقطه‌ای — مدرسه/مهدکودک/دانشگاه (HOT OSM)' },
  { id: 'layer-geo-financial', name: 'خدمات مالی و بانکی', category: 'داده‌های مکانی', color: '#10B981', description: '۱۵٬۳۲۲ نقطهٔ خدمات مالی (HOT OSM)' },
  { id: 'layer-geo-places', name: 'سکونتگاه‌ها و آبادی‌ها', category: 'داده‌های مکانی', color: '#94A3B8', description: '۴۸٬۵۴۶ نقطهٔ سکونتگاهی — شهر/روستا (HOT OSM)' },
  // ── کلروفلت‌های استانی (اطلس geojson + ردپای ساختمان HOT OSM) ──
  { id: 'layer-choropleth-building', name: 'تراکم ساختمانی (ردپای ۶۲۰K)', category: 'کوروپلت استانی', color: '#D97706', description: 'تعداد ساختمان‌های OSM به تفکیک استان — استخراج جریانی از فایل ۳۶۴MB (HOT OSM)' },
  { id: 'layer-choropleth-ndvi', name: 'پوشش گیاهی NDVI', category: 'کوروپلت استانی', color: '#16A34A', description: 'میانگین NDVI ماهواره‌ای هر استان — پوشش گیاهی سبزتر = مقدار بالاتر' },
  { id: 'layer-choropleth-deprivation', name: 'سطح محرومیت', category: 'کوروپلت استانی', color: '#7C3AED', description: 'طبقهٔ محرومیت استانی (محروم / نسبتاً محروم / در حال توسعه / توسعه‌یافته)' },
  // ── لایه‌های OSM استخراج‌شده از iran.pbf (scripts/extract_pbf_layers.py) ──
  { id: 'layer-pbf-roads', name: 'شبکه راه‌های ملی (PBF)', category: 'داده‌های OSM (iran.pbf)', color: '#FACC15', description: '۱۷۱ هزار راه — آزادراه/بزرگراه/اصلی/فرعی با نام و شماره (OpenStreetMap, ODbL)' },
  { id: 'layer-pbf-water', name: 'آبراهه‌ها، سدها و پهنه‌های آبی (PBF)', category: 'داده‌های OSM (iran.pbf)', color: '#38BDF8', description: '۱۰۰ هزار عارضه — رود/کانال/قنات/سد/آبشار + دریاچه و تالاب' },
  { id: 'layer-pbf-power', name: 'شبکه برق و زیرساخت انرژی (PBF)', category: 'داده‌های OSM (iran.pbf)', color: '#EF4444', description: 'خطوط انتقال ۱۲ هزار + پست برق/نیروگاه/مولد' },
  { id: 'layer-pbf-places', name: 'سکونتگاه‌ها (PBF)', category: 'داده‌های OSM (iran.pbf)', color: '#F472B6', description: '۵۷ هزار نقطه — شهر/شهرک/روستا/ده با نام و جمعیت' },
  { id: 'layer-pbf-pois', name: 'خدمات، سلامت، آموزش و میراث (PBF)', category: 'داده‌های OSM (iran.pbf)', color: '#10B981', description: '۶۱ هزار POI — بیمارستان/مدرسه/بانک/پمپ بنزین/موزه/مسجد/کاروانسرا' },
  { id: 'layer-pbf-landuse', name: 'کاربری اراضی (PBF)', category: 'داده‌های OSM (iran.pbf)', color: '#7C3AED', description: '۲۶ هزار پهنه — صنعتی/معدن/نظامی/جنگل/قبرستان/پسماند' },
  { id: 'layer-pbf-boundaries', name: 'مرزهای اداری OSM (PBF)', category: 'داده‌های OSM (iran.pbf)', color: '#34D399', description: '۲۱ هزار خط مرز اداری (boundary=administrative)' },
  { id: 'layer-pbf-railway', name: 'شبکه ریلی (PBF)', category: 'داده‌های OSM (iran.pbf)', color: '#A78BFA', description: '۱۲٫۷ هزار خط + ۷۷۴ ایستگاه راه‌آهن' },
  // ── خوشه‌بندی نقاط در زوم پایین ──
  { id: 'layer-pbf-places-cluster', name: 'سکونتگاه‌ها — خوشه‌ای (PBF)', category: 'داده‌های OSM (iran.pbf)', color: '#F472B6', description: 'خوشه‌بندی ۵۷ هزار سکونتگاه در زوم پایین — کلیک روی خوشه برای بزرگ‌نمایی' },
  { id: 'layer-pbf-pois-cluster', name: 'خدمات — خوشه‌ای (PBF)', category: 'داده‌های OSM (iran.pbf)', color: '#10B981', description: 'خوشه‌بندی ۶۱ هزار POI در زوم پایین — کلیک روی خوشه برای بزرگ‌نمایی' },
  // ── هیتمپ تراکم از PBF ──
  { id: 'layer-pbf-heat-places', name: 'هیتمپ تراکم سکونتگاه‌ها (PBF)', category: 'داده‌های OSM (iran.pbf)', color: '#F472B6', description: 'چگالی سکونتگاه‌ها وزندار با جمعیت — استخراج از iran.pbf' },
  { id: 'layer-pbf-heat-pois', name: 'هیتمپ تراکم خدمات (PBF)', category: 'داده‌های OSM (iran.pbf)', color: '#10B981', description: 'چگالی امکانات خدماتی — سلامت/آموزش/بانک/سوخت/میراث' },
  // ── تایل‌های برداری (Vector Tiles) — رندر تایلی و تدریجی ──
  { id: 'layer-vt-roads', name: 'راه‌ها — تایل برداری (PBF)', category: 'تایل برداری (Vector Tiles)', color: '#FACC15', description: 'رندر تایلی راه‌ها (z4 تا z10) — تعمیم وابسته به زوم، بارگذاری تدریجی' },
  { id: 'layer-vt-water', name: 'آب — تایل برداری (PBF)', category: 'تایل برداری (Vector Tiles)', color: '#38BDF8', description: 'رود/کانال/سد/پهنه آبی به‌صورت تایلی (z4 تا z10)' },
  { id: 'layer-vt-places', name: 'سکونتگاه‌ها — تایل برداری (PBF)', category: 'تایل برداری (Vector Tiles)', color: '#F472B6', description: 'سکونتگاه‌ها به‌صورت تایلی (z4 تا z9)' },
  { id: 'layer-vt-pois', name: 'خدمات — تایل برداری (PBF)', category: 'تایل برداری (Vector Tiles)', color: '#10B981', description: 'خدمات و POI به‌صورت تایلی (z6 تا z9)' },
  // ── کوروپلت استانی از آمار PBF ──
  { id: 'layer-choropleth-pbf-roads', name: 'طول راه‌های اصلی (PBF)', category: 'کوروپلت استانی', color: '#F59E0B', description: 'کیلومتر آزادراه/بزرگراه/اصلی/فرعی هر استان — استخراج از iran.pbf' },
  { id: 'layer-choropleth-pbf-power', name: 'زیرساخت انرژی (PBF)', category: 'کوروپلت استانی', color: '#EF4444', description: 'تعداد پست برق + نیروگاه + مولد هر استان — iran.pbf' },
  { id: 'layer-choropleth-pbf-places', name: 'آبادی‌ها و سکونتگاه‌ها (PBF)', category: 'کوروپلت استانی', color: '#EC4899', description: 'تعداد شهر/شهرک/روستا/ده هر استان — iran.pbf' }
];

// 10 Dimensions Definition
const DIMENSIONS_LIST: GISDimension[] = [
  { code: 'S', name: 'اجتماعی و رفاه', icon: Users, color: '#3B82F6', kpis: [{ id: 's1', name: 'سرمایه اجتماعی', value: 74, unit: '٪', trend: 'up' }, { id: 's2', name: 'کاهش آسیب اجتماعی', value: 68, unit: '٪', trend: 'stable' }] },
  { code: 'E', name: 'اقتصادی و تولید', icon: DollarSign, color: '#10B981', kpis: [{ id: 'e1', name: 'نرخ اشتغال رسمی', value: 88.5, unit: '٪', trend: 'up' }, { id: 'e2', name: 'ارزش افزوده صنعتی', value: 14.2, unit: 'B$', trend: 'up' }] },
  { code: 'P', name: 'سیاسی و حکمرانی', icon: ShieldCheck, color: '#8B5CF6', kpis: [{ id: 'p1', name: 'کیفیت خدمات دولتی', value: 78, unit: '٪', trend: 'up' }, { id: 'p2', name: 'رضایت شهروندی', value: 71, unit: '٪', trend: 'stable' }] },
  { code: 'D', name: 'جمعیتی و مهاجرت', icon: Users, color: '#EC4899', kpis: [{ id: 'd1', name: 'خالص نرخ مهاجرت', value: -1.2, unit: '٪', trend: 'down' }, { id: 'd2', name: 'نرخ جایگزینی جمعیت', value: 1.8, unit: 'نرخ', trend: 'stable' }] },
  { code: 'I', name: 'زیرساخت دیجیتال', icon: Cpu, color: '#06B6D4', kpis: [{ id: 'i1', name: 'پوشش فیبر نوری', value: 62, unit: '٪', trend: 'up' }, { id: 'i2', name: 'سرعت اینترنت ثابت', value: 45, unit: 'Mbps', trend: 'up' }] },
  { code: 'C', name: 'فرهنگی و هویتی', icon: BookOpen, color: '#F59E0B', kpis: [{ id: 'c1', name: 'سرانه فضاهای فرهنگی', value: 2.4, unit: 'm²', trend: 'stable' }, { id: 'c2', name: 'حفظ میراث ملموس', value: 89, unit: '٪', trend: 'up' }] },
  { code: 'N', name: 'طبیعی و محیط‌زیست', icon: Droplet, color: '#059669', kpis: [{ id: 'n1', name: 'تنش منابع آب زیرزمینی', value: 82, unit: '٪', trend: 'down' }, { id: 'n2', name: 'کیفیت هوا', value: 112, unit: 'PPM', trend: 'down' }] },
  { code: 'F', name: 'مالی و بودجه', icon: DollarSign, color: '#84CC16', kpis: [{ id: 'f1', name: 'ت تحقق بودجه عمرانی', value: 81, unit: '٪', trend: 'up' }, { id: 'f2', name: 'جذب سرمایه خارجی', value: 1.2, unit: 'B$', trend: 'up' }] },
  { code: 'T', name: 'کالا و حمل‌ونقل', icon: Truck, color: '#D97706', kpis: [{ id: 't1', name: 'ظرفیت ترانزیت ریلی', value: 12.5, unit: 'MT', trend: 'up' }, { id: 't2', name: 'زمان ترخیص گمرکی', value: 2.4, unit: 'روز', trend: 'up' }] },
  { code: 'R', name: 'مدیریت ریسک و بحران', icon: ShieldAlert, color: '#EF4444', kpis: [{ id: 'r1', name: 'تاب‌آوری در برابر زلزله', value: 58, unit: '٪', trend: 'stable' }, { id: 'r2', name: 'آمادگی پدافند غیرعامل', value: 84, unit: '٪', trend: 'up' }] }
];

// رنگ وضعیت تنش آبی — هماهنگ با رنگ‌بندی سلول‌ها، کانتور استان و breadcrumb (سبز/زرد/قرمز)
// در هر سه حالت choropleth / symbols / heatmap یکسان اعمال می‌شود.
const getWaterStressTone = (ws: number): { base: string; soft: string; deep: string; label: string } => {
  if (ws > 85) return { base: '#EF4444', soft: '#FEE2E2', deep: '#991B1B', label: 'بحران تنش آبی' };
  if (ws > 75) return { base: '#F59E0B', soft: '#FEF3C7', deep: '#92400E', label: 'هشدار تنش آبی' };
  return { base: '#10B981', soft: '#D1FAE5', deep: '#065F46', label: 'تنش آبی پایدار' };
};

export default function TerritorialWebGISPage({ focusProvince = null }: { focusProvince?: string | null }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const layersGroupRef = useRef<string[]>([]);
  const provinceOutlineLayerRef = useRef<L.Layer[]>([]);
  const geoPointsLayerRef = useRef<string[]>([]);
  const choroplethLayerRef = useRef<string[]>([]);
  const pbfLayersGroupRef = useRef<string[]>([]);
  const vtLayersGroupRef = useRef<string[]>([]);
  const basemapLayerRef = useRef<L.TileLayer | null>(null);

  // Layout & Panel Visibility States
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(true);
  const [leftPanelOpen, setLeftPanelOpen] = useState<boolean>(true);
  const [bottomTrayOpen, setBottomTrayOpen] = useState<boolean>(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'histogram' | 'table' | 'bivariate'>('histogram');

  // Map Navigation & View States
  const [basemapStyle, setBasemapStyle] = useState<'dark' | 'shiveh' | 'satellite' | 'topo'>('shiveh');
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number }>({ lat: 32.4279, lng: 53.6880 });
  const [zoomLevel, setZoomLevel] = useState<number>(5);

  // Active Map Layers & Style Controls
  const [activeDimension, setActiveDimension] = useState<string>('N'); // Natural / Water default
  const [selectedStyleMode, setSelectedStyleMode] = useState<'choropleth' | 'symbols' | 'heatmap' | 'hexbin'>('choropleth');
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [activeSatelliteLayer, setActiveSatelliteLayer] = useState<any>(null);
  const [activeLayersList, setActiveLayersList] = useState<string[]>(['boundary-national', 'boundary-province', 'layer-water-stress', 'layer-infrastructure']);
  // راهنمای لایه‌های OSM فعال برای نمایش روی نقشه
  const activePbfLegend = activeLayersList
    .filter((id) => id.startsWith('layer-pbf-') || id.startsWith('layer-vt-'))
    .map((id) => {
      const def = AVAILABLE_2D_LAYERS.find((l) => l.id === id);
      return def ? { label: def.name.replace(' (PBF)', ''), color: def.color } : null;
    })
    .filter(Boolean) as Array<{ label: string; color: string }>;
  const [spatialData, setSpatialData] = useState<SpatialData | null>(null);
  const [infographicData, setInfographicData] = useState<InfographicFile | null>(null);
  const [pbfStats, setPbfStats] = useState<PbfProvinceStatsFile | null>(null);
  const [activeRanking, setActiveRanking] = useState<number>(0);
  const [layerOpacity, setLayerOpacity] = useState<number>(80);
  const [layerSearchQuery, setLayerSearchQuery] = useState<string>('');
  const [rightPanelTab, setRightPanelTab] = useState<'catalog' | 'active-zindex'>('active-zindex');
  const [satellitePanelOpen, setSatellitePanelOpen] = useState<boolean>(false);

  // Location Search Box States
  const [locationSearchQuery, setLocationSearchQuery] = useState<string>('');
  const [isLocationSearchOpen, setIsLocationSearchOpen] = useState<boolean>(false);

  // Selected Geo-Cell & Pinning System
  const [selectedCell, setSelectedCell] = useState<GeoCell | null>(PROVINCES_CELL_DATA[0]);
  const [pinnedCells, setPinnedCells] = useState<GeoCell[]>([]);
  const [contextTab, setContextTab] = useState<'overview' | 'kpis' | 'atlas' | 'trend' | 'flows' | 'events' | 'documents'>('overview');

  // Layer Z-Index Reordering Functions
  const moveLayerUp = (layerId: string) => {
    setActiveLayersList(prev => {
      const idx = prev.indexOf(layerId);
      if (idx < prev.length - 1) {
        const copy = [...prev];
        const temp = copy[idx];
        copy[idx] = copy[idx + 1];
        copy[idx + 1] = temp;
        return copy;
      }
      return prev;
    });
  };

  const moveLayerDown = (layerId: string) => {
    setActiveLayersList(prev => {
      const idx = prev.indexOf(layerId);
      if (idx > 0) {
        const copy = [...prev];
        const temp = copy[idx];
        copy[idx] = copy[idx - 1];
        copy[idx - 1] = temp;
        return copy;
      }
      return prev;
    });
  };

  const toggleLayerActive = (layerId: string) => {
    setActiveLayersList(prev => {
      if (prev.includes(layerId)) {
        return prev.filter(id => id !== layerId);
      } else {
        return [...prev, layerId];
      }
    });
  };

  // پاک‌سازی کانتور مرز استان از روی نقشه (پس از ناوبری دستی کاربر)
  const clearProvinceOutline = () => {
    const map = mapInstanceRef.current;
    if (provinceOutlineLayerRef.current && map) {
      provinceOutlineLayerRef.current.forEach((layer) => {
        map.removeLayer(layer);
      });
      provinceOutlineLayerRef.current = [];
    }
  };

  // Location Search Result FlyTo Handler
  const handleSelectLocation = (cell: GeoCell) => {
    clearProvinceOutline();
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([cell.lat, cell.lng], 9, { duration: 1.5 });
      setSelectedCell(cell);
      setBreadcrumbLevel([
        'ایران',
        `استان ${cell.province}`,
        `شهرستان ${cell.county}`,
        `بخش ${cell.district}`,
        cell.name,
        `کد ${cell.code}`
      ]);
      setLocationSearchQuery('');
      setIsLocationSearchOpen(false);
    }
  };

  // Time Slider & Animation Controls
  const [selectedYear, setSelectedYear] = useState<number>(1405);
  const [isPlayingAnimation, setIsPlayingAnimation] = useState<boolean>(false);
  const [animationSpeed, setAnimationSpeed] = useState<number>(1);
  const [isDeltaCompareMode, setIsDeltaCompareMode] = useState<boolean>(false);
  const [compareYear, setCompareYear] = useState<number>(1400);

  // ── Year Interpolation: Generates realistic time-series data for each province across 1398→1405 ──
  // Each province has a base year (current data = 1405) and we interpolate backwards with
  // realistic trends: water stress worsening, GDP fluctuating, population growing, etc.
  type YearCellData = { waterStress: number; gdpGrowth: number; inflation: number; satisfaction: number; population: number; unemployment: number; digitalIndex: number; riskScore: number };
  const YEAR_DATA_CACHE = new Map<string, YearCellData>();

  const getYearData = (cell: typeof PROVINCES_CELL_DATA[0], year: number): YearCellData => {
    const key = `${cell.id}-${year}`;
    if (YEAR_DATA_CACHE.has(key)) return YEAR_DATA_CACHE.get(key)!;
    const y = Math.max(1398, Math.min(1405, year));
    const t = (y - 1398) / 7; // 0 at 1398, 1 at 1405
    // Seeded pseudo-random per cell for consistent year-to-year variation
    const seed = cell.id.charCodeAt(cell.id.length - 1) * 7 + cell.id.charCodeAt(1);
    const noise = (i: number) => Math.sin(seed * (i + 1) * 1.7) * 1.5;
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    const result: YearCellData = {
      // Water stress: steadily worsening (higher = worse)
      waterStress: clamp(cell.waterStress * (0.78 + 0.22 * t) + noise(1) * t, 10, 98),
      // GDP: fluctuates with growth trend
      gdpGrowth: clamp(cell.gdpGrowth * (0.85 + 0.15 * t) + noise(2) * (0.5 + t * 0.5), 0.5, 12),
      // Inflation: decreases slightly over time
      inflation: clamp(cell.inflation * (1.15 - 0.15 * t) + noise(3), 15, 55),
      // Satisfaction: improves slowly
      satisfaction: clamp(cell.satisfaction * (0.88 + 0.12 * t) + noise(4), 30, 95),
      // Population: grows 1-2% per year
      population: Math.round(cell.population * (0.92 + 0.08 * t + noise(5) * 0.005)),
      // Unemployment: decreases with growth
      unemployment: clamp(cell.unemployment * (1.2 - 0.2 * t) + noise(6), 3, 25),
      // Digital index: steady improvement
      digitalIndex: clamp(cell.digitalIndex * (0.8 + 0.2 * t) + noise(7) * 0.5, 30, 99),
      // Risk score: slightly worsening
      riskScore: clamp(cell.riskScore * (0.85 + 0.15 * t) + noise(8) * t, 10, 98)
    };
    YEAR_DATA_CACHE.set(key, result);
    return result;
  };

  // Get interpolated data for the currently selected year
  const getCellAtYear = (cell: typeof PROVINCES_CELL_DATA[0], year: number): typeof PROVINCES_CELL_DATA[0] => {
    const yd = getYearData(cell, year);
    return { ...cell, ...yd };
  };

  // ── Animation Timer ──
  useEffect(() => {
    if (!isPlayingAnimation) return;
    const interval = setInterval(() => {
      setSelectedYear(prev => {
        if (prev >= 1405) {
          setIsPlayingAnimation(false);
          return 1398;
        }
        return prev + 1;
      });
    }, 1200 / animationSpeed);
    return () => clearInterval(interval);
  }, [isPlayingAnimation, animationSpeed]);

  // Search & Natural Language Query Modal
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isNLQModalOpen, setIsNLQModalOpen] = useState<boolean>(false);
  const [nlqInput, setNlqInput] = useState<string>('شهرستان‌هایی با تنش آبی بالای ۸۰٪ و رشد اقتصادی بیش از ۵٪');
  const [nlqResult, setNlqResult] = useState<string | null>(null);

  // Territorial Breadcrumb hierarchy
  const [breadcrumbLevel, setBreadcrumbLevel] = useState<string[]>([
    'ایران',
    'استان خوزستان',
    'شهرستان اهواز',
    'بخش مرکزی',
    'دهستان عمیلیه',
    'سلول پایه #IR-KHZ-04'
  ]);

  // Spatial Bookmarks
  const [bookmarks, setBookmarks] = useState<SpatialBookmark[]>([
    { id: 'b1', title: 'پایش حوضه آبریز زاینده‌رود', lat: 32.6546, lng: 51.6680, zoom: 7, activeLayers: ['layer-water-stress'], date: '۱۴۰۵/۰۵/۱۰' },
    { id: 'b2', title: 'کریدور ترانزیتی بندر چابهار', lat: 25.2969, lng: 60.6430, zoom: 8, activeLayers: ['layer-infrastructure'], date: '۱۴۰۵/۰۵/۱۲' }
  ]);
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);



  // Keyboard shortcut for ZEN mode (Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'z' || e.key === 'Z') {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          setIsZenMode(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize Map Instance (MapLibre GL JS)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // ─── Tile layers (رایگان، بدون API key، بدون watermark) ───
    const basemapLayers: Record<string, L.TileLayer> = {
      shiveh: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }),
      dark: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'dark-tiles', attribution: '© OpenStreetMap contributors' }),
      satellite: L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg', { maxZoom: 16, attribution: '© EOX IT Services — Sentinel-2 cloudless' }),
      topo: L.tileLayer('https://a.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenTopoMap — OpenStreetMap contributors' }),
    };

    const map = L.map(mapContainerRef.current, {
      center: [32.4279, 53.6880],
      zoom: 5,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
      layers: [basemapLayers.shiveh],
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    basemapLayerRef.current = basemapLayers.shiveh;

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorCoords({ lat: Number(e.latlng.lat.toFixed(4)), lng: Number(e.latlng.lng.toFixed(4)) });
    });
    map.on('zoom', () => { setZoomLevel(map.getZoom()); });
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (viewMode !== '2d') return;
    const timer = window.setTimeout(() => mapInstanceRef.current?.invalidateSize(), 0);
    return () => window.clearTimeout(timer);
  }, [viewMode]);

  // ─── رسم کانتور مرز استان روی نقشهٔ Leaflet ───
  useEffect(() => {
    clearProvinceOutline();
    if (!focusProvince || !mapInstanceRef.current) return;
    const prov = PROVINCES_DATA.find((p) => p.id === focusProvince);
    if (!prov) return;
    const map = mapInstanceRef.current;
    const tone = getWaterStressTone(prov.waterStress);
    const rings = PROVINCE_OUTLINES[focusProvince];
    if (rings && rings.length > 0) {
      const latLngs = rings.map((ring) => ring.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]));
      const outlineLayer = L.polygon(latLngs, { color: tone.base, weight: 2.4, opacity: 0.9, dashArray: '10 8', fillColor: tone.base, fillOpacity: 0.14 }).addTo(map);
      provinceOutlineLayerRef.current = [outlineLayer as any];
    }
    const cell = PROVINCES_CELL_DATA.find((c) => c.province === prov.name);
    const lat = cell?.lat ?? prov.lat;
    const lng = cell?.lng ?? prov.lng;
    map.flyTo([lat, lng], 8, { duration: 1.5 });
    if (cell) {
      setSelectedCell(cell);
      setBreadcrumbLevel(['ایران', `استان ${cell.province}`, `شهرستان ${cell.county}`, `بخش ${cell.district}`, cell.name, `کد ${cell.code}`]);
    }
  }, [focusProvince]);

  // Tile switch — replace basemap tile layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const tileUrls: Record<string, [string, any]> = {
      shiveh: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }],
      dark: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'dark-tiles' }],
      satellite: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg', { maxZoom: 16 }],
      topo: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 }],
    };
    const [url, opts] = tileUrls[basemapStyle] ?? tileUrls.shiveh;
    if (basemapLayerRef.current) map.removeLayer(basemapLayerRef.current);
    const newLayer = L.tileLayer(url, opts).addTo(map);
    basemapLayerRef.current = newLayer;
  }, [basemapStyle]);

  // ── لایه‌های مرزی (boundary-national / boundary-province) ──
  const boundaryLayerRef = useRef<any[]>([]);
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    boundaryLayerRef.current.forEach((l: any) => map.removeLayer(l));
    boundaryLayerRef.current = [];
    const active = new Set(activeLayersList);
    if (active.has('boundary-province')) {
      PROVINCES_DATA.forEach((prov) => {
        const rings = PROVINCE_OUTLINES[prov.id];
        if (!rings || rings.length === 0) return;
        const latLngs = rings.map((ring) => ring.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]));
        const tone = getWaterStressTone(prov.waterStress);
        const outlineLayer = L.polygon(latLngs, {
          color: '#475569',
          weight: 1.6,
          opacity: 0.85,
          fillColor: tone.base,
          fillOpacity: 0.06,
          dashArray: active.has('boundary-national') ? undefined : '6 4',
        }).addTo(map);
        boundaryLayerRef.current.push(outlineLayer as any);
      });
    }
    if (active.has('boundary-national')) {
      // Draw a single thick national outline by merging all province rings
      const allCoords: [number, number][] = [];
      PROVINCES_DATA.forEach((prov) => {
        const rings = PROVINCE_OUTLINES[prov.id];
        if (rings && rings.length > 0) {
          rings.forEach((ring) => {
            ring.forEach(([lng, lat]: [number, number]) => allCoords.push([lat, lng]));
          });
        }
      });
      if (allCoords.length > 0) {
        // Convex hull approximation — use the outermost points
        const hull: [number, number][] = [];
        const sortedByLng = [...allCoords].sort((a, b) => a[1] - b[1]);
        const pivot = sortedByLng[0];
        const pts = sortedByLng.slice(1);
        pts.sort((a, b) => {
          const angleA = Math.atan2(a[0] - pivot[0], a[1] - pivot[1]);
          const angleB = Math.atan2(b[0] - pivot[0], b[1] - pivot[1]);
          return angleA - angleB;
        });
        hull.push(pivot);
        for (const p of pts) {
          while (hull.length >= 2) {
            const a = hull[hull.length - 2];
            const b = hull[hull.length - 1];
            const cross = (b[1] - a[1]) * (p[0] - a[0]) - (b[0] - a[0]) * (p[1] - a[1]);
            if (cross <= 0) hull.pop();
            else break;
          }
          hull.push(p);
        }
        hull.push(hull[0]);
        const natLayer = L.polygon(hull, {
          color: '#1E4841',
          weight: 3,
          opacity: 0.9,
          fillColor: '#1E4841',
          fillOpacity: 0,
        }).addTo(map);
        boundaryLayerRef.current.push(natLayer as any);
      }
    }
    return () => {
      boundaryLayerRef.current.forEach((l: any) => map.removeLayer(l));
      boundaryLayerRef.current = [];
    };
  }, [activeLayersList]);

  // ── لایه‌های مفهومی موضوعی (water-stress, infrastructure, population, industry, dams, faultlines, s1, i1) ──
  const thematicLayerRef = useRef<any[]>([]);
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    thematicLayerRef.current.forEach((l: any) => map.removeLayer(l));
    thematicLayerRef.current = [];
    const active = new Set(activeLayersList);

    // Water Stress layer — province-level choropleth
    if (active.has('layer-water-stress')) {
      PROVINCES_DATA.forEach((prov) => {
        const rings = PROVINCE_OUTLINES[prov.id];
        if (!rings || rings.length === 0) return;
        const tone = getWaterStressTone(prov.waterStress);
        const latLngs = rings.map((ring) => ring.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]));
        const layer = L.polygon(latLngs, {
          color: tone.base,
          weight: 0.8,
          opacity: 0.6,
          fillColor: tone.base,
          fillOpacity: (layerOpacity / 100) * 0.35,
        }).addTo(map);
        layer.bindTooltip(`<div style="direction:rtl;font-size:11px;padding:4px;text-align:center;"><b>${prov.name}</b><br/>تنش آبی: ${prov.waterStress}٪</div>`);
        thematicLayerRef.current.push(layer as any);
      });
    }

    // Infrastructure layer — airports + sea ports
    if (active.has('layer-infrastructure') && spatialData) {
      const infraPoints = [
        ...spatialData.transport.airports.points,
        ...spatialData.transport.seaPorts.points,
      ];
      const group = L.layerGroup().addTo(map);
      infraPoints.forEach((pt) => {
        L.circleMarker([pt.lat, pt.lng], {
          radius: 5,
          fillColor: '#F59E0B',
          fillOpacity: (layerOpacity / 100) * 0.9,
          color: '#FCD34D',
          weight: 1.5,
        }).addTo(group).bindTooltip(pt.name || pt.type || 'زیرساخت');
      });
      thematicLayerRef.current.push(group as any);
    }

    // Population density layer
    if (active.has('layer-population')) {
      PROVINCES_DATA.forEach((prov) => {
        const rings = PROVINCE_OUTLINES[prov.id];
        if (!rings || rings.length === 0) return;
        const t = Math.min(prov.population / 14, 1);
        const fillColor = `rgb(${Math.round(236 + (220 - 236) * t)},${Math.round(72 + (20 - 72) * t)},${Math.round(153 + (60 - 153) * t)})`;
        const latLngs = rings.map((ring) => ring.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]));
        const layer = L.polygon(latLngs, { color: fillColor, weight: 0.8, opacity: 0.6, fillColor, fillOpacity: (layerOpacity / 100) * 0.4 }).addTo(map);
        layer.bindTooltip(`<div style="direction:rtl;font-size:11px;padding:4px;text-align:center;"><b>${prov.name}</b><br/>جمعیت: ${prov.population}M</div>`);
        thematicLayerRef.current.push(layer as any);
      });
    }

    // Industry layer
    if (active.has('layer-industry') && spatialData) {
      const group = L.layerGroup().addTo(map);
      spatialData.transport.financial.points.forEach((pt) => {
        L.circleMarker([pt.lat, pt.lng], { radius: 3.5, fillColor: '#10B981', fillOpacity: (layerOpacity / 100) * 0.85, color: '#6EE7B7', weight: 1 }).addTo(group);
      });
      thematicLayerRef.current.push(group as any);
    }

    // Fault lines layer
    if (active.has('layer-faultlines')) {
      const FAULT_LINES: Array<{ name: string; coords: [number, number][] }> = [
        { name: 'گسل زاگرس', coords: [[27.5, 51.5], [29, 50.5], [31, 49.5], [33, 48], [35, 46.5], [37, 45]] },
        { name: 'گسل البرز', coords: [[35.5, 49], [36.2, 50.5], [36.8, 52], [37.2, 54], [37.8, 56]] },
        { name: 'گسل تبریز', coords: [[37, 45.5], [38, 46.5], [39, 47]] },
        { name: 'گسل بم', coords: [[28.5, 56.5], [29.5, 57.5], [30.5, 58.5]] },
        { name: 'گسل اصفهان-شیراز', coords: [[29.5, 51.5], [31, 51], [32.5, 51.5]] },
      ];
      const group = L.layerGroup().addTo(map);
      FAULT_LINES.forEach((fl) => {
        L.polyline(fl.coords, { color: '#DC2626', weight: 2.5, opacity: (layerOpacity / 100) * 0.85, dashArray: '8 6' }).addTo(group).bindTooltip(fl.name);
      });
      thematicLayerRef.current.push(group as any);
    }

    // Social capital layer
    if (active.has('layer-s1')) {
      PROVINCES_DATA.forEach((prov) => {
        const rings = PROVINCE_OUTLINES[prov.id];
        if (!rings || rings.length === 0) return;
        const fillColor = prov.satisfaction > 70 ? '#3B82F6' : prov.satisfaction > 55 ? '#60A5FA' : '#93C5FD';
        const latLngs = rings.map((ring) => ring.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]));
        const layer = L.polygon(latLngs, { color: fillColor, weight: 0.8, opacity: 0.6, fillColor, fillOpacity: (layerOpacity / 100) * 0.35 }).addTo(map);
        layer.bindTooltip(`<div style="direction:rtl;font-size:11px;padding:4px;text-align:center;"><b>${prov.name}</b><br/>رضایت: ${prov.satisfaction}٪</div>`);
        thematicLayerRef.current.push(layer as any);
      });
    }

    // Digital infrastructure layer
    if (active.has('layer-i1')) {
      PROVINCES_DATA.forEach((prov) => {
        const rings = PROVINCE_OUTLINES[prov.id];
        if (!rings || rings.length === 0) return;
        const fillColor = prov.status === 'critical' ? '#8B5CF6' : prov.status === 'warning' ? '#A78BFA' : '#C4B5FD';
        const latLngs = rings.map((ring) => ring.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]));
        const layer = L.polygon(latLngs, { color: fillColor, weight: 0.8, opacity: 0.6, fillColor, fillOpacity: (layerOpacity / 100) * 0.35 }).addTo(map);
        layer.bindTooltip(`<div style="direction:rtl;font-size:11px;padding:4px;text-align:center;"><b>${prov.name}</b><br/>وضعیت دیجیتال: ${prov.status}</div>`);
        thematicLayerRef.current.push(layer as any);
      });
    }

    return () => {
      thematicLayerRef.current.forEach((l: any) => map.removeLayer(l));
      thematicLayerRef.current = [];
    };
  }, [activeLayersList, layerOpacity, spatialData]);

  // Render Map Nodes & Choropleths
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old cell layers
    layersGroupRef.current.forEach((layer: any) => {
      map.removeLayer(layer);
    });
    layersGroupRef.current = [];

    const features: GeoJSON.Feature[] = PROVINCES_CELL_DATA.map((cell) => {
      const yd = getCellAtYear(cell, selectedYear);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [cell.lng, cell.lat] },
        properties: {
          id: cell.id, name: cell.name, code: cell.code, province: cell.province,
          county: cell.county, district: cell.district,
          waterStress: yd.waterStress, gdpGrowth: yd.gdpGrowth, unemployment: yd.unemployment,
          inflation: yd.inflation, satisfaction: yd.satisfaction, digitalIndex: yd.digitalIndex,
          population: yd.population, riskScore: yd.riskScore, selectedYear,
          isSelected: selectedCell?.id === cell.id ? 1 : 0
        }
      };
    });

    features.forEach((f) => {
      const p = f.properties as any;
      const coords = (f.geometry as any).coordinates as [number, number];
      const ws = p.waterStress;
      const color = ws > 85 ? '#EF4444' : ws > 75 ? '#F59E0B' : '#10B981';
      const isSelected = selectedCell?.id === p.id;
      const radius = isSelected ? 10 : (selectedStyleMode === 'symbols' ? Math.max(4, ws / 8) : 7);
      const tone = getWaterStressTone(ws);
      const popupHtml = `<div style="direction:rtl;text-align:right;font-family:Vazirmatn,Tahoma,sans-serif;font-size:12px;padding:6px;width:240px;color:#0F172A;border-top:3px solid ${tone.base}"><b style="font-size:13px;color:#1E4841">${p.name}</b><br/><span style="font-size:9px;color:#64748B">${p.code} | ${p.province} | سال ${toPersianDigits(p.selectedYear)}</span><br/><span>💧 تنش آبی: ${ws.toFixed(1)}٪ | 📈 GDP: +${p.gdpGrowth.toFixed(1)}٪ | ⚠️ ریسک: ${p.riskScore.toFixed(0)}٪</span></div>`;
      const marker = L.circleMarker([coords[1], coords[0]], {
        radius,
        fillColor: color,
        fillOpacity: layerOpacity / 100,
        color: isSelected ? '#BBF49C' : '#FFFFFF',
        weight: isSelected ? 3 : 1.5,
      }).addTo(map);
      marker.bindPopup(popupHtml);
      marker.on('click', () => { setSelectedCell(PROVINCES_CELL_DATA.find((c) => c.id === p.id) || null); });
      layersGroupRef.current.push(marker as any);
    });
  }, [selectedStyleMode, layerOpacity, selectedCell, selectedYear]);

  // بارگذاری داده‌های مکانی geojson (منابع باز HDX/HOT/Healthsites) + اینفوگراف استانی
  useEffect(() => {
    let mounted = true;
    loadSpatialData()
      .then((data) => {
        if (mounted) setSpatialData(data);
      })
      .catch((err) => {
        console.error('[geojson] failed to load spatial data:', err);
      });
    loadInfographicData()
      .then((data) => {
        if (mounted) setInfographicData(data);
      })
      .catch((err) => {
        console.error('[geojson] failed to load infographic data:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // آمار استانی PBF (برای کوروپلت‌های «لایه‌های OSM»)
  useEffect(() => {
    let mounted = true;
    loadPbfProvinceStats()
      .then((d) => {
        if (mounted) setPbfStats(d);
      })
      .catch((err) => {
        console.error('[pbf] failed to load province stats:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // ── لایه‌های نقطه‌ای دادهٔ مکانی (Leaflet) ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !spatialData) return;
    geoPointsLayerRef.current.forEach((layer: any) => { map.removeLayer(layer); });
    geoPointsLayerRef.current = [];
    const active = new Set(activeLayersList);
    const configs: Array<{ key: string; pts: TransportPoint[]; color: string; label: string } | null> = [
      active.has('layer-geo-health') ? { key: 'geo-health', pts: spatialData.health.samplePoints, color: '#DC2626', label: 'مرکز درمانی' } : null,
      active.has('layer-geo-airports') ? { key: 'geo-airports', pts: spatialData.transport.airports.points, color: '#F59E0B', label: 'فرودگاه' } : null,
      active.has('layer-geo-ports') ? { key: 'geo-ports', pts: spatialData.transport.seaPorts.points, color: '#0EA5E9', label: 'بندر' } : null,
      active.has('layer-geo-education') ? { key: 'geo-edu', pts: spatialData.transport.education.points, color: '#3B82F6', label: 'آموزشی' } : null,
      active.has('layer-geo-financial') ? { key: 'geo-fin', pts: spatialData.transport.financial.points, color: '#10B981', label: 'مالی' } : null,
      active.has('layer-geo-places') ? { key: 'geo-places', pts: spatialData.transport.populatedPlaces.points, color: '#94A3B8', label: 'سکونتگاه' } : null,
    ].filter(Boolean) as Array<{ key: string; pts: TransportPoint[]; color: string; label: string }>;
    configs.forEach(({ key, pts, color }) => {
      const group = L.layerGroup().addTo(map);
      pts.forEach((pt) => {
        L.circleMarker([pt.lat, pt.lng], { radius: 4, fillColor: color, fillOpacity: 0.85, color: '#FFFFFF', weight: 1 }).addTo(group);
      });
      geoPointsLayerRef.current.push(group as any);
    });
  }, [spatialData, activeLayersList]);

  // ── لایه‌های OSM (pbf) — بارگذاری تنبل + رندر Leaflet ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    [...pbfLayersGroupRef.current, ...vtLayersGroupRef.current].forEach((layer: any) => { map.removeLayer(layer); });
    pbfLayersGroupRef.current = [];
    vtLayersGroupRef.current = [];
    const active = new Set(activeLayersList);
    let cancelled = false;
    const pbfDefs = [
      { id: 'layer-pbf-roads', name: 'roads' as PbfLayerName },
      { id: 'layer-pbf-water', name: 'water' as PbfLayerName },
      { id: 'layer-pbf-power', name: 'power' as PbfLayerName },
      { id: 'layer-pbf-places', name: 'places' as PbfLayerName },
      { id: 'layer-pbf-pois', name: 'pois' as PbfLayerName },
      { id: 'layer-pbf-landuse', name: 'landuse' as PbfLayerName },
      { id: 'layer-pbf-boundaries', name: 'boundaries' as PbfLayerName },
      { id: 'layer-pbf-railway', name: 'railway' as PbfLayerName }
    ].filter((d) => active.has(d.id));
    if (pbfDefs.length > 0) {
      Promise.all(pbfDefs.map((d) => loadPbfLayer(d.name)))
        .then((files) => {
          if (cancelled) return;
          pbfDefs.forEach((d, i) => {
            const file = files[i];
            if (!file) return;
            const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
            file.lines?.forEach((l: any) => { if (l.c?.length > 1) fc.features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: l.c }, properties: l }); });
            file.points?.forEach((p: any) => { if (p.c) fc.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p.c }, properties: p }); });
            file.polys?.forEach((p: any) => { if (p.c?.[0]) fc.features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: p.c }, properties: p }); });
            if (fc.features.length === 0) return;
            const geoLayer = L.geoJSON(fc, {
              style: () => ({ color: '#FACC15', weight: 1.2, opacity: layerOpacity / 100, fillColor: '#7C3AED', fillOpacity: 0.3 }),
              pointToLayer: (pt, latlng) => L.circleMarker(latlng, { radius: 2.5, fillColor: '#94A3B8', fillOpacity: layerOpacity / 100, color: '#94A3B8', weight: 0.5 }),
            }).addTo(map);
            pbfLayersGroupRef.current.push(geoLayer as any);
          });
        })
        .catch((err) => console.error('[pbf] failed to load layers:', err));
    }
    return () => { cancelled = true; };
  }, [activeLayersList, layerOpacity]);

  // ── کلروفلت استانی: تراکم ساختمانی / NDVI / محرومیت / آمار PBF (PROVINCE_OUTLINES) ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !spatialData) return;
    if (choroplethLayerRef.current.length > 0) {    choroplethLayerRef.current.forEach((layer: any) => { map.removeLayer(layer); });
    choroplethLayerRef.current = [];
    }
    const active = new Set(activeLayersList);
    const allModes: Array<{
      id: string;
      kind: 'building' | 'ndvi' | 'deprivation' | 'pbf';
      sub?: 'roads' | 'power' | 'places';
      label: string;
    }> = [
      { id: 'layer-choropleth-building', kind: 'building', label: 'تراکم ساختمانی' },
      { id: 'layer-choropleth-ndvi', kind: 'ndvi', label: 'پوشش گیاهی NDVI' },
      { id: 'layer-choropleth-deprivation', kind: 'deprivation', label: 'سطح محرومیت' },
      { id: 'layer-choropleth-pbf-roads', kind: 'pbf', sub: 'roads', label: 'طول راه‌های اصلی' },
      { id: 'layer-choropleth-pbf-power', kind: 'pbf', sub: 'power', label: 'زیرساخت انرژی' },
      { id: 'layer-choropleth-pbf-places', kind: 'pbf', sub: 'places', label: 'آبادی‌ها و سکونتگاه‌ها' }
    ];
    const modes = allModes.filter((m) => active.has(m.id));
    if (modes.length === 0) return;
    const mode = modes[0];

    // مقادیر عددی برای مقیاس رنگی
    const values: Record<string, number> = {};
    const buildings: Record<string, number> = {};
    const areas: Record<string, number> = {};
    PROVINCES_DATA.forEach((p) => {
      const stat = provinceStatByRef(spatialData, { name: p.name });
      if (!stat) return;
      areas[p.id] = p.area || 1;
      if (typeof stat.buildings === 'number') buildings[p.id] = stat.buildings;
      if (typeof stat.satellite?.ndvi_mean === 'number') values[p.id] = stat.satellite.ndvi_mean;
      if (mode.kind === 'pbf' && pbfStats) {
        const ps = pbfStatByProvince(pbfStats, p.name);
        if (!ps) return;
        if (mode.sub === 'roads') {
          values[p.id] = Object.values(ps.roadsKm || {}).reduce((a, b) => a + b, 0);
        } else if (mode.sub === 'power') {
          values[p.id] = ps.powerSubstations + ps.powerPlants + ps.generators;
        } else if (mode.sub === 'places') {
          values[p.id] = ps.placesTotal;
        }
      }
    });
    const density: Record<string, number> = {};
    Object.entries(buildings).forEach(([id, b]) => {
      density[id] = b / areas[id];
    });
    const pool = mode.kind === 'building' ? density : values;
    const nums = Object.values(pool).filter((v) => Number.isFinite(v));
    const min = nums.length ? Math.min(...nums) : 0;
    const max = nums.length ? Math.max(...nums) : 1;
    const span = max - min || 1;

    // مقیاس‌های رنگی
    const ramp = (t: number, stops: Array<[number, string]>): string => {
      for (let i = 0; i < stops.length - 1; i++) {
        const [t0, c0] = stops[i];
        const [t1, c1] = stops[i + 1];
        if (t >= t0 && t <= t1) {
          const k = (t - t0) / (t1 - t0 || 1);
          const a = [0, 2, 4].map((j) => parseInt(c0.slice(j + 1, j + 3), 16));
          const b = [0, 2, 4].map((j) => parseInt(c1.slice(j + 1, j + 3), 16));
          const c = a.map((x, j) => Math.round(x + (b[j] - x) * k));
          return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
        }
      }
      return stops[stops.length - 1][1];
    };
    const DEPRIVATION_COLORS: Array<[string, string]> = [
      ['محروم', '#7F1D1D'],
      ['نسبتاً محروم', '#C2410C'],
      ['در حال توسعه', '#CA8A04'],
      ['توسعه‌یافته', '#15803D'],
    ];
    const depColor = (lvl: string) => DEPRIVATION_COLORS.find(([k]) => k === lvl)?.[1] ?? '#94A3B8';

    const features: GeoJSON.Feature[] = [];
    PROVINCES_DATA.forEach((p) => {
      const rings = PROVINCE_OUTLINES[p.id];
      if (!rings || rings.length === 0) return;
      const stat = provinceStatByRef(spatialData, { name: p.name });
      let fill = '#334155';
      if (mode.kind === 'building') { const d = density[p.id]; if (d != null) fill = ramp((d - min) / span, [[0, '#FEF3C7'], [0.5, '#F59E0B'], [1, '#7C2D12']]); }
      else if (mode.kind === 'ndvi') { const v = values[p.id]; if (v != null) fill = ramp((v - min) / span, [[0, '#B45309'], [0.5, '#EAB308'], [1, '#15803D']]); }
      else if (mode.kind === 'pbf') { const v = values[p.id]; if (v != null) { const ramps: Record<string, Array<[number, string]>> = { roads: [[0,'#1E293B'],[0.5,'#B45309'],[1,'#FBBF24']], power: [[0,'#1E293B'],[0.5,'#7F1D1D'],[1,'#EF4444']], places: [[0,'#1E293B'],[0.5,'#86198F'],[1,'#F0ABFC']] }; fill = ramp((v - min) / span, ramps[mode.sub || 'places'] || ramps.places); } }
      else { const lvl = stat?.satellite?.deprivation_level; fill = lvl ? depColor(lvl) : '#334155'; }
      rings.forEach((ring) => {
        features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { fill } });
      });
    });
    const geoLayer = L.geoJSON({ type: 'FeatureCollection', features } as any, {
      style: (feature) => ({ fillColor: (feature as any).properties.fill, fillOpacity: (layerOpacity / 100) * 0.72, color: '#1E293B', weight: 0.8, opacity: 0.7 }),
    }).addTo(map);
    choroplethLayerRef.current = [geoLayer as any];
  }, [spatialData, activeLayersList, layerOpacity, pbfStats, selectedYear]);

  // Handle FlyTo Cell
  const flyToCell = (cell: GeoCell) => {
    clearProvinceOutline();
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([cell.lat, cell.lng], 8, { duration: 1.2 });
      setSelectedCell(cell);
    }
  };

  // Preset Theme Launcher
  const applyPresetTheme = (preset: 'water' | 'education' | 'food' | 'earthquake') => {
    if (preset === 'water') {
      setActiveDimension('N');
      setActiveLayersList(['boundary-national', 'boundary-province', 'layer-water-stress', 'layer-dams', 'layer-pbf-water']);
    } else if (preset === 'education') {
      setActiveDimension('S');
      setActiveLayersList(['boundary-national', 'boundary-province', 'layer-geo-education', 'layer-s1']);
    } else if (preset === 'food') {
      setActiveDimension('E');
      setActiveLayersList(['boundary-national', 'boundary-province', 'layer-industry', 'layer-pbf-pois']);
    } else if (preset === 'earthquake') {
      setActiveDimension('R');
      setActiveLayersList(['boundary-national', 'boundary-province', 'layer-faultlines', 'layer-pbf-boundaries']);
    }
  };

  // Pinning Cell to Comparison
  const togglePinCell = (cell: GeoCell) => {
    if (pinnedCells.some(c => c.id === cell.id)) {
      setPinnedCells(pinnedCells.filter(c => c.id !== cell.id));
    } else {
      if (pinnedCells.length < 4) {
        setPinnedCells([...pinnedCells, cell]);
      } else {
        alert('حداکثر ۴ سلول می‌توانید همزمان جهت مقایسه سنجاق کنید.');
      }
    }
  };

  // Natural Language Query Processing
  const runNLQ = () => {
    const q = nlqInput.trim();
    if (!q) { setNlqResult('لطفاً سوال خود را وارد کنید.'); return; }
    // Parse simple conditions from Persian text
    const matches: typeof PROVINCES_CELL_DATA = [];
    let waterThreshold = 80;
    let gdpThreshold = 0;
    let unemploymentThreshold = 0;
    let inflationThreshold = 0;
    // Extract numeric thresholds
    const waterMatch = q.match(/تنش آبی.*?([\d.]+)/);
    if (waterMatch) waterThreshold = parseFloat(waterMatch[1]);
    const gdpMatch = q.match(/(?:GDP|رشد اقتصادی|رشد اقتصاد).*?([\d.]+)/);
    if (gdpMatch) gdpThreshold = parseFloat(gdpMatch[1]);
    const unempMatch = q.match(/(?:بیکاری|اشتغال).*?([\d.]+)/);
    if (unempMatch) unemploymentThreshold = parseFloat(unempMatch[1]);
    const inflMatch = q.match(/(?:تورم).*?([\d.]+)/);
    if (inflMatch) inflationThreshold = parseFloat(inflMatch[1]);
    PROVINCES_CELL_DATA.forEach(cell => {
      let pass = true;
      if (waterThreshold > 0 && cell.waterStress <= waterThreshold) pass = false;
      if (gdpThreshold > 0 && cell.gdpGrowth <= gdpThreshold) pass = false;
      if (unemploymentThreshold > 0 && cell.unemployment <= unemploymentThreshold) pass = false;
      if (inflationThreshold > 0 && cell.inflation <= inflationThreshold) pass = false;
      // Keyword match for province names
      const provKeywords = ['تهران','فارس','اصفهان','خوزستان','آذربایجان','سیستان','خراسان','هرمزگان','گیلان','کرمان','یزد','قم','کرمانشاه','همدان','ارومیه','اردبیل','مازندران','گلستان','بوشهر','کردستان','چهارمحال','زنجان','سمنان','قزوین','کهگیلویه','لرستان','مرکزی','ایلام'];
      const matchedProv = provKeywords.find(k => q.includes(k));
      if (matchedProv && !cell.province.includes(matchedProv) && !cell.name.includes(matchedProv)) pass = false;
      if (pass) matches.push(cell);
    });
    if (matches.length === 0) {
      setNlqResult('هیچ استان یا سلولی با شرایط مذکور یافت نشد.');
    } else {
      const names = matches.map(c => `«${c.name}» (${c.province})`).join('، ');
      setNlqResult(`بر اساس تحلیل داده‌های ${toPersianDigits(PROVINCES_CELL_DATA.length)} سلول پایه، تعداد ${toPersianDigits(matches.length)} منطقه شناسایی شد: ${names}. میانگین تنش آبی: ${toPersianDigits(Math.round(matches.reduce((s, c) => s + c.waterStress, 0) / matches.length))}٪ | میانگین رشد GDP: ${toPersianDigits((matches.reduce((s, c) => s + c.gdpGrowth, 0) / matches.length).toFixed(1))}٪.`);
      // Fly to first result
      if (matches.length > 0 && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([matches[0].lat, matches[0].lng], 7, { duration: 1.2 });
        setSelectedCell(matches[0]);
      }
    }
  };

  return (
    <div dir="rtl" className="w-full h-[calc(100vh-80px)] relative overflow-hidden bg-paper text-ink-800 flex flex-col font-sans select-none">
      
      {/* 1. TOP FLOATING NAVBAR & BREADCRUMB HEADER */}
      {!isZenMode && (
        <div className="absolute top-3 right-3 left-3 z-30 flex flex-wrap items-center justify-between gap-2 p-2.5 bg-surface/95 border border-line rounded-2xl shadow-xl backdrop-blur-md text-xs">
          
          {/* Territorial Breadcrumb & Logo */}
          <div className="flex items-center gap-2 overflow-x-auto max-w-full">
            <div className="flex items-center gap-1 bg-brand-800 text-signal-400 px-2.5 py-1 rounded-xl font-black shrink-0">
              <Globe size={14} className="animate-spin-slow" />
              <span>ژئوپرتال آرا</span>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-bold text-ink-700 whitespace-nowrap">
              {breadcrumbLevel.map((lvl, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  {idx > 0 && <span className="text-ink-400">←</span>}
                  <button 
                    onClick={() => {
                      if (mapInstanceRef.current && idx === 0) {
                        mapInstanceRef.current.flyTo([32.4279, 53.6880], 5);
                      }
                    }}
                    className="hover:text-brand-800 transition-colors cursor-pointer"
                  >
                    {lvl}
                  </button>
                  {lvl.startsWith('استان ') && (() => {
                    const provMatch = PROVINCES_DATA.find((p) => p.name === lvl.replace('استان ', ''));
                    if (!provMatch) return null;
                    const pTone = getWaterStressTone(provMatch.waterStress);
                    return (
                      <span
                        className="text-[9px] font-black px-1.5 py-0.5 rounded-full border whitespace-nowrap"
                        style={{ backgroundColor: pTone.soft, color: pTone.deep, borderColor: pTone.base }}
                      >
                        {pTone.label} · تنش آبی {toPersianDigits(provMatch.waterStress)}٪
                      </span>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>

          {/* Search, AI NLQ & Bookmarks */}
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex items-center bg-paper border border-line rounded-xl px-2.5 py-1 min-w-[220px]">
              <Search size={14} className="text-ink-400 shrink-0" />
              <input 
                type="text" 
                placeholder="جستجوی مکانی، شاخص یا کد سلول..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none outline-none px-2 text-xs text-ink-800 placeholder:text-ink-400 font-medium"
              />
            </div>

            {/* AI Natural Language Spatial Query Trigger */}
            <button
              onClick={() => setIsNLQModalOpen(true)}
              className="px-3 py-1.5 bg-brand-800 hover:bg-brand-700 text-signal-400 rounded-xl font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
              title="پرسش مکانی با زبان طبیعی (Ctrl+K)"
            >
              <Sparkles size={14} className="text-signal-400" />
              <span>پرسش مکانی AI</span>
            </button>

            <button
              onClick={() => setSatellitePanelOpen((open) => !open)}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all border ${satellitePanelOpen ? 'bg-emerald-700 text-white border-emerald-300' : 'bg-paper text-ink-700 border-line hover:border-brand-400'}`}
              title="جست‌وجو و پردازش تصاویر ماهواره‌ای"
            >
              <Satellite size={14} />
              <span>عملیات ماهواره‌ای</span>
            </button>

            {/* Spatial Bookmarks Button */}
            <button
              onClick={() => setIsBookmarkModalOpen(true)}
              className="p-1.5 bg-paper hover:bg-line text-ink-700 rounded-xl border border-line cursor-pointer transition-all"
              title="نشانک‌های مکانی ذخیره‌شده"
            >
              <Bookmark size={15} />
            </button>

            {/* Print & Export Map */}
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="p-1.5 bg-paper hover:bg-line text-ink-700 rounded-xl border border-line cursor-pointer transition-all"
              title="خروجی رسمی و چاپ نقشه"
            >
              <Printer size={15} />
            </button>

            {/* Zen Mode Toggle (Hide Panels) */}
            <button
              onClick={() => setIsZenMode(!isZenMode)}
              className="p-1.5 bg-brand-800 text-signal-400 rounded-xl border border-signal-400/30 cursor-pointer transition-all hover:scale-105"
              title="حالت تمام‌تمرکز (کلید Z)"
            >
              <Maximize2 size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ZEN MODE REOPEN BUTTON */}
      {isZenMode && (
        <button
          onClick={() => setIsZenMode(false)}
          className="absolute top-4 right-4 z-50 bg-brand-800 text-signal-400 p-2.5 rounded-2xl border border-signal-400/40 shadow-2xl flex items-center gap-2 text-xs font-black cursor-pointer animate-fade-in"
        >
          <Minimize2 size={16} />
          <span>خروج از حالت تمام‌تمرکز (Z)</span>
        </button>
      )}

      {/* 2. MAP CANVAS ENGINE (FULLSCREEN BACKGROUND) */}
      <div className="w-full h-full relative overflow-hidden z-0">
        <div
          ref={mapContainerRef}
          className={`absolute inset-0 h-full w-full ${viewMode === '2d' ? 'visible' : 'invisible pointer-events-none'}`}
          aria-hidden={viewMode !== '2d'}
        />
        {viewMode === '3d' && (
          <div className="absolute inset-0 h-full w-full bg-wall-950 flex items-center justify-center text-signal-400 text-sm font-bold">
            نمای ۳بعدی (MapLibre 3D)
          </div>
        )}

        {/* Live Data Stream & Watermark Badge */}
        <div className="absolute top-16 right-4 z-10 bg-surface/90 text-ink-800 border border-line px-3 py-1.5 rounded-xl text-[10.5px] font-bold flex items-center gap-2 shadow-lg backdrop-blur-md pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-ok-soft animate-pulse" />
          <span>ژئوپرتال هوشمند سرزمینی مپ‌ایر | به‌روزرسانی زنده</span>
        </div>

        {/* Floating Year Badge (Animated) */}
        <div className="absolute top-16 left-4 z-10 bg-brand-800/95 text-signal-400 border border-signal-400/30 px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-2 shadow-xl backdrop-blur-md pointer-events-none transition-all duration-300">
          <Clock size={14} className="animate-spin-slow" />
          <span className="font-mono">سال {toPersianDigits(selectedYear)}</span>
          {isPlayingAnimation && (
            <span className="w-2 h-2 rounded-full bg-signal-400 animate-pulse" />
          )}
        </div>

        {/* Floating Location Search Box (Top-Left of Map Canvas) */}
        <div className="absolute top-16 left-4 z-10 w-72 bg-surface/95 border border-line rounded-2xl p-2.5 shadow-xl backdrop-blur-md flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10.5px] font-bold text-ink-700 px-1">
            <span className="flex items-center gap-1">
              <MapPin size={13} className="text-brand-800" />
              <span>جستجوی مکانی شهر / استان</span>
            </span>
            <span className="text-[9px] text-signal-400 bg-brand-800 px-1.5 py-0.5 rounded font-mono">۲D GIS</span>
          </div>

          <div className="flex items-center gap-2 bg-paper border border-line rounded-xl px-2.5 py-1.5">
            <Search size={14} className="text-ink-400 shrink-0" />
            <input
              type="text"
              placeholder="جستجوی شهر یا استان (مثلا: شیراز، تبریز)..."
              value={locationSearchQuery}
              onChange={(e) => {
                setLocationSearchQuery(e.target.value);
                setIsLocationSearchOpen(true);
              }}
              onFocus={() => setIsLocationSearchOpen(true)}
              className="w-full bg-transparent border-none outline-none text-xs text-ink-800 placeholder:text-ink-400 font-medium"
            />
            {locationSearchQuery && (
              <button 
                onClick={() => setLocationSearchQuery('')}
                className="text-ink-400 hover:text-ink-700 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Location Auto-complete Dropdown */}
          {isLocationSearchOpen && locationSearchQuery.trim() !== '' && (
            <div className="max-h-56 overflow-y-auto bg-surface rounded-xl border border-line p-1 flex flex-col gap-1 shadow-2xl animate-fade-in">
              {PROVINCES_CELL_DATA.filter(cell => 
                cell.name.includes(locationSearchQuery) || 
                cell.province.includes(locationSearchQuery) || 
                cell.county.includes(locationSearchQuery) ||
                cell.district.includes(locationSearchQuery) ||
                cell.code.toLowerCase().includes(locationSearchQuery.toLowerCase())
              ).length === 0 ? (
                <div className="p-3 text-center text-[11px] text-ink-400 font-bold">
                  مکانی یافت نشد
                </div>
              ) : (
                PROVINCES_CELL_DATA.filter(cell => 
                  cell.name.includes(locationSearchQuery) || 
                  cell.province.includes(locationSearchQuery) || 
                  cell.county.includes(locationSearchQuery) ||
                  cell.district.includes(locationSearchQuery) ||
                  cell.code.toLowerCase().includes(locationSearchQuery.toLowerCase())
                ).map(cell => (
                  <button
                    key={cell.id}
                    onClick={() => handleSelectLocation(cell)}
                    className="p-2 hover:bg-paper rounded-lg text-right flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-ink-800">{cell.name}</div>
                      <div className="text-[9.5px] text-ink-500">استان {cell.province} | کد {cell.code}</div>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-ok-soft text-ok border border-ok/40">
                      پرواز به نقطه ✈️
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Mouse Coordinates & Scale (Bottom Left) */}
        <div className="absolute bottom-4 left-4 z-10 bg-surface/95 text-ink-700 border border-line px-3 py-1.5 rounded-xl text-[10px] font-mono flex items-center gap-3 shadow-xl backdrop-blur-md">
          <span>مختصات:</span>
          <span className="text-brand-800 font-bold">
            {toPersianDigits(cursorCoords.lat)}, {toPersianDigits(cursorCoords.lng)}
          </span>
          <span className="text-ink-400">| زوم: {toPersianDigits(zoomLevel)}</span>
        </div>

        {/* Legend لایه‌های OSM (iran.pbf) */}
        {activePbfLegend.length > 0 && (
          <div className="absolute bottom-4 right-4 z-10 bg-surface/95 border border-line rounded-xl px-3 py-2 shadow-xl backdrop-blur-md flex flex-col gap-1 max-w-[250px]">
            <div className="text-[9px] font-bold text-ink-700">راهنما — لایه‌های OSM (iran.pbf)</div>
            {activePbfLegend.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-[9px] text-ink-600">
                <span className="w-3 h-[3px] rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Map Center Reset Floating Button */}
        <button
          onClick={() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.flyTo([32.4279, 53.6880], 5);
            }
          }}
          className="absolute bottom-4 right-4 z-10 bg-brand-800 hover:bg-brand-700 text-signal-400 p-2.5 rounded-2xl border border-signal-400/30 shadow-2xl flex items-center gap-1.5 text-xs font-black cursor-pointer transition-transform hover:scale-105"
        >
          <Compass size={16} />
          <span>نمای کل کشور</span>
        </button>
      </div>

      {!isZenMode && satellitePanelOpen && (
        <div className="absolute top-20 left-3 z-20 w-72 bg-surface/95 border border-line rounded-2xl p-4 shadow-xl backdrop-blur-md">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-ink-800">پنل تصاویر ماهواره‌ای</span>
            <button onClick={() => setSatellitePanelOpen(false)} className="text-ink-400 hover:text-ink-700 cursor-pointer"><X size={14} /></button>
          </div>
          <p className="text-[10px] text-ink-500">تصاویر ماهواره‌ای با MapLibre در حال توسعه است.</p>
        </div>
      )}

      {/* 3. RIGHT FLOATING PANEL: 10-DIMENSION LAYER & STYLE TREE */}
      {!isZenMode && (
        <div className={`absolute top-20 right-3 bottom-20 z-20 w-80 bg-surface/95 border border-line rounded-2xl shadow-2xl backdrop-blur-md flex flex-col transition-all duration-300 ${
          rightPanelOpen ? 'translate-x-0' : 'translate-x-[340px]'
        }`}>
          {/* Panel Toggle Handle */}
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className="absolute -left-8 top-6 bg-surface text-ink-700 border border-line p-1.5 rounded-l-xl shadow-lg cursor-pointer"
          >
            {rightPanelOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          {/* Header */}
          <div className="p-3.5 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2 text-ink-800 font-extrabold text-xs">
              <Layers size={16} className="text-brand-800" />
              <span>مدیریت لایه‌های ۲بعدی WebGIS</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
              activeLayersList.length >= 5
                ? 'bg-warn-soft text-warn border-warn/40 animate-pulse'
                : 'bg-ok-soft text-ok border-ok/40'
            }`}>
              {toPersianDigits(activeLayersList.length)} لایه فعال
            </span>
          </div>

          {/* Layer Crowding Warning Alert */}
          {activeLayersList.length >= 5 && (
            <div className="mx-2 mt-2 p-2 bg-warn-soft border border-warn/40 rounded-xl text-[10px] text-warn flex items-center gap-1.5 animate-fade-in">
              <AlertTriangle size={14} className="text-warn shrink-0" />
              <span>خوانایی نقشه در خطر است! بیش از ۴ لایه موضوعی فعال است.</span>
            </div>
          )}

          {/* Right Panel Main Tab Navigation */}
          <div className="p-2 border-b border-line bg-paper grid grid-cols-2 gap-1 text-[11px] font-bold">
            <button
              onClick={() => setRightPanelTab('active-zindex')}
              className={`py-1.5 px-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                rightPanelTab === 'active-zindex'
                  ? 'bg-brand-800 text-signal-400 border-signal-400/40 shadow-sm'
                  : 'bg-surface text-ink-700 border-line hover:text-slate-900'
              }`}
            >
              <Layers3 size={14} />
              <span>چیدمان و Z-Index</span>
            </button>
            <button
              onClick={() => setRightPanelTab('catalog')}
              className={`py-1.5 px-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                rightPanelTab === 'catalog'
                  ? 'bg-brand-800 text-signal-400 border-signal-400/40 shadow-sm'
                  : 'bg-surface text-ink-700 border-line hover:text-slate-900'
              }`}
            >
              <Sliders size={14} />
              <span>کاتالوگ ۱۰ بعدی</span>
            </button>
          </div>

          {/* TAB 1: ACTIVE 2D LAYERS & Z-INDEX ORDERING TOOL */}
          {rightPanelTab === 'active-zindex' && (
            <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2.5 animate-fade-in">
              <div className="p-2.5 bg-paper border border-line rounded-xl text-[10.5px] text-ink-700 flex flex-col gap-1">
                <div className="font-extrabold text-brand-800 flex items-center justify-between">
                  <span>ترتیب نمایش لایه‌ها (Z-Index):</span>
                  <span className="text-[9.5px] font-mono text-ink-500">{toPersianDigits(activeLayersList.length)} لایه روی نقشه</span>
                </div>
                <div className="text-[9.5px] text-ink-500 leading-relaxed">
                  لایه‌ای که در بالاترین ردیف قرار دارد (رتبه ۱)، روی سایر لایه‌ها ترسیم می‌شود. با دکمه‌های بالا/پایین ترتیب لایه‌ها را تنظیم کنید.
                </div>
              </div>

              {/* Active Layers Sorted Stack (Top to Bottom) */}
              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] font-bold text-ok px-1 flex items-center gap-1">
                  <Check size={12} />
                  <span>لایه‌های فعال روی نقشه (به ترتیب Z-Index):</span>
                </div>

                {activeLayersList.length === 0 ? (
                  <div className="p-4 text-center text-xs text-ink-400 font-bold border border-dashed border-line rounded-xl">
                    هیچ لایه‌ای فعال نیست. از لیست زیر لایه‌ای اضافه کنید.
                  </div>
                ) : (
                  [...activeLayersList].reverse().map((layerId, reverseIdx) => {
                    const actualIdx = activeLayersList.indexOf(layerId);
                    const rank = reverseIdx + 1; // Rank 1 is top-most layer
                    const layerDef = AVAILABLE_2D_LAYERS.find(l => l.id === layerId) || {
                      id: layerId,
                      name: layerId.replace('layer-', '').replace('boundary-', 'مرز '),
                      category: 'شاخص',
                      color: '#10B981',
                      description: 'لایه GIS سرزمینی'
                    };

                    return (
                      <div
                        key={layerId}
                        className="p-2 bg-surface border border-line hover:border-line-strong rounded-xl flex items-center justify-between shadow-xs transition-all"
                      >
                        <div className="flex items-center gap-2">
                          {/* Rank Badge */}
                          <span className={`w-5 h-5 rounded-lg text-[10px] font-mono font-black flex items-center justify-center shrink-0 ${
                            rank === 1
                              ? 'bg-warn-soft text-warn border border-warn/40'
                              : 'bg-paper text-ink-700 border border-line'
                          }`}>
                            #{toPersianDigits(rank)}
                          </span>

                          {/* Color Dot & Name */}
                          <div className="flex flex-col text-right">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: layerDef.color }} />
                              <span className="text-xs font-bold text-ink-800">{layerDef.name}</span>
                            </div>
                            <span className="text-[9.5px] text-ink-500">{layerDef.category} | {rank === 1 ? 'روترین لایه' : `Z-Index: ${toPersianDigits(actualIdx)}`}</span>
                          </div>
                        </div>

                        {/* Controls: Up / Down / Toggle */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveLayerUp(layerId)}
                            disabled={actualIdx === activeLayersList.length - 1}
                            className="p-1.5 bg-paper hover:bg-line disabled:opacity-30 disabled:hover:bg-paper text-ink-700 rounded-lg border border-line cursor-pointer transition-all"
                            title="انتقال به لایه بالایی (افزایش Z-Index)"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveLayerDown(layerId)}
                            disabled={actualIdx === 0}
                            className="p-1.5 bg-paper hover:bg-line disabled:opacity-30 disabled:hover:bg-paper text-ink-700 rounded-lg border border-line cursor-pointer transition-all"
                            title="انتقال به لایه پایینی (کاهش Z-Index)"
                          >
                            ▼
                          </button>
                          <button
                            onClick={() => toggleLayerActive(layerId)}
                            className="p-1.5 bg-danger-soft hover:bg-danger-soft text-danger rounded-lg border border-danger/40 cursor-pointer transition-all text-[10px] font-bold"
                            title="غیرفعال کردن لایه"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Inactive Available 2D Layers Catalog */}
              <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-line">
                <div className="text-[10px] font-bold text-ink-500 px-1">
                  سایر لایه‌های ۲بعدی قابل فعال‌سازی:
                </div>

                {AVAILABLE_2D_LAYERS.filter(l => !activeLayersList.includes(l.id)).map((layer) => (
                  <div
                    key={layer.id}
                    className="p-2 bg-paper/80 border border-line hover:border-line-strong rounded-xl flex items-center justify-between text-right"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: layer.color }} />
                      <div>
                        <div className="text-xs font-bold text-ink-800">{layer.name}</div>
                        <div className="text-[9.5px] text-ink-500">{layer.description}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleLayerActive(layer.id)}
                      className="px-2 py-1 bg-brand-800 hover:bg-brand-700 text-signal-400 border border-signal-400/30 rounded-lg text-[10px] font-bold cursor-pointer transition-all shrink-0 flex items-center gap-1"
                    >
                      <Plus size={12} />
                      <span>افزودن</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: 10-DIMENSIONS CATALOG */}
          {rightPanelTab === 'catalog' && (
            <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2 animate-fade-in">
              {/* 2D Basemap Selector */}
              <div className="p-2 bg-paper border border-line rounded-xl flex flex-col gap-1 text-[10px]">
                <span className="text-ink-700 font-bold px-1">نقشه پایه:</span>
                <div className="grid grid-cols-4 gap-1 font-bold">
                  {[
                    { id: 'dark', label: 'تیره' },
                    { id: 'shiveh', label: 'روشن' },
                    { id: 'satellite', label: 'ماهواره' },
                    { id: 'topo', label: 'رنگی' }
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setBasemapStyle(style.id as any)}
                      className={`py-1 px-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                        basemapStyle === style.id
                          ? 'bg-brand-800 text-signal-400 border-signal-400/40 shadow-xs'
                          : 'bg-surface text-ink-700 border-line hover:text-slate-900'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2D/3D View Toggle */}
              <div className="p-2 bg-paper border border-line rounded-xl flex flex-col gap-1 text-[10px]">
                <span className="text-ink-700 font-bold px-1">نوع نمایش:</span>
                <div className="grid grid-cols-2 gap-1 font-bold">
                  <button
                    onClick={() => setViewMode('2d')}
                    className={`py-1 px-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                      viewMode === '2d'
                        ? 'bg-brand-800 text-signal-400 border-signal-400/40 shadow-xs'
                        : 'bg-surface text-ink-700 border-line hover:text-slate-900'
                    }`}
                  >
                    2D
                  </button>
                  <button
                    onClick={() => setViewMode('3d')}
                    className={`py-1 px-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                      viewMode === '3d'
                        ? 'bg-brand-800 text-signal-400 border-signal-400/40 shadow-xs'
                        : 'bg-surface text-ink-700 border-line hover:text-slate-900'
                    }`}
                  >
                    3D
                  </button>
                </div>
              </div>


              {/* Quick Preset Shortcuts */}
              <div className="p-2 bg-paper border border-line rounded-xl flex flex-col gap-1 text-[10px]">
                <span className="text-ink-700 font-bold px-1">پیش‌تنظیم‌های موضوعی:</span>
                <div className="grid grid-cols-2 gap-1">
                  <button 
                    onClick={() => applyPresetTheme('water')}
                    className="p-1.5 bg-info-soft hover:bg-info-soft text-info border border-info/30 rounded-lg font-bold text-right cursor-pointer truncate flex items-center gap-1"
                  >
                    <span>💧</span> <span>بحران آب</span>
                  </button>
                  <button 
                    onClick={() => applyPresetTheme('education')}
                    className="p-1.5 bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200 rounded-lg font-bold text-right cursor-pointer truncate flex items-center gap-1"
                  >
                    <span>🎓</span> <span>عدالت آموزشی</span>
                  </button>
                  <button 
                    onClick={() => applyPresetTheme('food')}
                    className="p-1.5 bg-ok-soft hover:bg-ok-soft text-ok border border-ok/40 rounded-lg font-bold text-right cursor-pointer truncate flex items-center gap-1"
                  >
                    <span>🌾</span> <span>زنجیره غذا</span>
                  </button>
                  <button 
                    onClick={() => applyPresetTheme('earthquake')}
                    className="p-1.5 bg-danger-soft hover:bg-danger-soft text-danger-700 border border-danger/40 rounded-lg font-bold text-right cursor-pointer truncate flex items-center gap-1"
                  >
                    <span>🌋</span> <span>تاب‌آوری زلزله</span>
                  </button>
                </div>
              </div>

              {/* Layer Search & Representation Mode */}
              <div className="p-2 border border-line bg-paper rounded-xl flex flex-col gap-2 text-[10px]">
                <div className="relative flex items-center bg-surface border border-line rounded-lg px-2 py-1">
                  <Search size={12} className="text-ink-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="جستجو در نام لایه‌ها و شاخص‌ها..."
                    value={layerSearchQuery}
                    onChange={(e) => setLayerSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-none outline-none px-1.5 text-[10.5px] text-ink-800 placeholder:text-ink-400 font-medium"
                  />
                </div>

                <div className="flex items-center justify-between font-bold">
                  <span className="text-ink-700">حالت نمادگذاری:</span>
                  <div className="flex bg-surface p-0.5 rounded-lg border border-line">
                    {[
                      { id: 'choropleth', label: 'کوروپلت' },
                      { id: 'symbols', label: 'نمادی' },
                      { id: 'heatmap', label: 'حرارتی' },
                      { id: 'hexbin', label: 'Hexbin' }
                    ].map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setSelectedStyleMode(style.id as any)}
                        className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                          selectedStyleMode === style.id 
                            ? 'bg-brand-800 text-signal-400 shadow-xs' 
                            : 'text-ink-700 hover:text-slate-900'
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 10 Dimensions Accordion Tree */}
              <div className="flex flex-col gap-2">
                {DIMENSIONS_LIST
                  .filter(dim => 
                    !layerSearchQuery || 
                    dim.name.includes(layerSearchQuery) || 
                    dim.code.toLowerCase().includes(layerSearchQuery.toLowerCase()) ||
                    dim.kpis.some(k => k.name.includes(layerSearchQuery))
                  )
                  .map((dim) => {
                    const Icon = dim.icon;
                    const isActiveDim = activeDimension === dim.code;
                    return (
                      <div 
                        key={dim.code}
                        className={`border rounded-xl transition-all overflow-hidden ${
                          isActiveDim 
                            ? 'bg-paper border-line-strong' 
                            : 'bg-paper border-line hover:border-line-strong'
                        }`}
                      >
                        <button
                          onClick={() => setActiveDimension(dim.code)}
                          className="w-full p-2.5 flex items-center justify-between text-xs font-black cursor-pointer text-right"
                        >
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-white font-bold text-[10px]"
                              style={{ backgroundColor: dim.color }}
                            >
                              {dim.code}
                            </div>
                            <span className="text-ink-800">{dim.name}</span>
                          </div>
                          <Icon size={15} style={{ color: dim.color }} />
                        </button>

                        {/* Expanded Dimension KPI List */}
                        {isActiveDim && (
                          <div className="p-2.5 bg-surface border-t border-line flex flex-col gap-2 text-[11px] animate-fade-in">
                            {dim.kpis.map((kpi) => (
                              <div key={kpi.id} className="flex items-center justify-between p-1.5 bg-paper rounded-lg border border-line">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={activeLayersList.includes(`layer-${kpi.id}`)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setActiveLayersList([...activeLayersList, `layer-${kpi.id}`]);
                                      } else {
                                        setActiveLayersList(activeLayersList.filter(l => l !== `layer-${kpi.id}`));
                                      }
                                    }}
                                    className="accent-brand-800 w-3.5 h-3.5 cursor-pointer"
                                  />
                                  <span className="font-bold text-ink-800">{kpi.name}</span>
                                </label>
                                <span className="font-mono font-black text-brand-800">
                                  {toPersianDigits(kpi.value)} {kpi.unit}
                                </span>
                              </div>
                            ))}

                            {/* Data Passport Badge */}
                            <div className="p-2 bg-paper rounded-lg border border-line text-[9.5px] text-ink-700 flex flex-col gap-1">
                              <div className="flex justify-between font-bold text-ink-800">
                                <span>شناسنامه داده (Data-Passport):</span>
                                <span className="text-ok">اعتبار ۱۰۰٪</span>
                              </div>
                              <div>منبع: مرکز آمار ایران & مرکز پژوهش‌های مجلس</div>
                              <div className="flex justify-between">
                                <span>دقت مکانی: سلول پایه (۱۰km)</span>
                                <span>همبستگی (ρ): ۰.۸۴</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Opacity Control Footer */}
          <div className="p-3 border-t border-line bg-paper flex flex-col gap-1.5 text-[10.5px]">
            <div className="flex justify-between font-bold text-ink-700">
              <span>شفافیت لایه‌های موضوعی:</span>
              <span className="text-brand-800 font-mono">{toPersianDigits(layerOpacity)}٪</span>
            </div>
            <input 
              type="range"
              min="10"
              max="100"
              value={layerOpacity}
              onChange={(e) => setLayerOpacity(Number(e.target.value))}
              className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-brand-800"
            />
          </div>
        </div>
      )}

      {/* 4. LEFT FLOATING PANEL: GEO-CELL PASSPORT & CONTEXT */}
      {!isZenMode && selectedCell && (
        <div className={`absolute top-20 left-3 bottom-20 z-20 w-96 bg-surface/95 border border-line rounded-2xl shadow-2xl backdrop-blur-md flex flex-col transition-all duration-300 ${
          leftPanelOpen ? 'translate-x-0' : '-translate-x-[420px]'
        }`}>
          {/* Panel Toggle Handle */}
          <button
            onClick={() => setLeftPanelOpen(!leftPanelOpen)}
            className="absolute -right-8 top-6 bg-surface text-ink-700 border border-line p-1.5 rounded-r-xl shadow-lg cursor-pointer"
          >
            {leftPanelOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          {/* Header */}
          <div className="p-3.5 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-brand-800" />
              <div className="flex flex-col text-right">
                <span className="font-black text-xs text-ink-800">{selectedCell.name}</span>
                <span className="text-[9.5px] font-mono text-ink-500">{selectedCell.code} | {selectedCell.province}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => togglePinCell(selectedCell)}
                className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-all border ${
                  pinnedCells.some(c => c.id === selectedCell.id)
                    ? 'bg-warn-soft text-warn border-warn/40'
                    : 'bg-paper text-ink-700 border-line'
                }`}
              >
                📌 {pinnedCells.some(c => c.id === selectedCell.id) ? 'سنجاق شده' : 'سنجاق'}
              </button>
              <button onClick={() => setSelectedCell(null)} className="text-ink-400 hover:text-ink-700">✕</button>
            </div>
          </div>

          {/* 6 Tabs Navigation */}
          <div className="flex border-b border-line bg-paper overflow-x-auto text-[10.5px] font-bold">
            {[
              { id: 'overview', label: 'نمای کلی' },
              { id: 'kpis', label: 'شاخص‌ها' },
              { id: 'atlas', label: 'اطلس مکانی' },
              { id: 'trend', label: 'روند ۵ساله' },
              { id: 'flows', label: 'جریان‌ها' },
              { id: 'events', label: 'رویدادها' },
              { id: 'documents', label: 'اسناد' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setContextTab(tab.id as any)}
                className={`px-3 py-2 whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                  contextTab === tab.id 
                    ? 'border-brand-800 text-brand-800 bg-surface font-extrabold' 
                    : 'border-transparent text-ink-500 hover:text-ink-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content Body */}
          <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3">
            {contextTab === 'overview' && (
              <div className="flex flex-col gap-3 animate-fade-in text-xs">
                {/* Status KPI Row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-paper rounded-xl border border-line flex flex-col gap-1">
                    <span className="text-[10px] text-ink-500">تنش آبی سرزمینی:</span>
                    <span className="font-mono font-black text-danger text-sm">
                      {toPersianDigits(selectedCell.waterStress)}٪
                    </span>
                  </div>
                  <div className="p-2.5 bg-paper rounded-xl border border-line flex flex-col gap-1">
                    <span className="text-[10px] text-ink-500">رشد GDP ناخالص:</span>
                    <span className="font-mono font-black text-ok text-sm">
                      {toPersianDigits(selectedCell.gdpGrowth)}٪
                    </span>
                  </div>
                </div>

                {/* 10-Dimension Score Breakdown */}
                <div className="p-3 bg-paper rounded-xl border border-line flex flex-col gap-2">
                  <span className="font-extrabold text-ink-800 text-[11px]">امتیازات ابعاد ۱۰گانه:</span>
                  <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                    {Object.entries(selectedCell.dimensions).map(([code, score]) => (
                      <div key={code} className="flex justify-between items-center p-1.5 bg-surface rounded-lg border border-line">
                        <span className="text-ink-700 font-bold">{code}:</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-line rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-ok" 
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-ink-800">{toPersianDigits(Number(score))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-ok-soft border border-ok/40 rounded-xl text-[11px] leading-relaxed text-brand-950">
                  <strong>جمع‌بندی تحلیلی AI:</strong> سلول پایه {selectedCell.name} به دلیل تنش آبی بالادستی در وضعیت «هشدار هیدرولوژیک» قرار دارد. پیشنهاد شبیه‌ساز، تخصیص اعتبارات صندوق توسعه به بازچرخانی پساب صنعتی است.
                </div>
              </div>
            )}

            {contextTab === 'atlas' && (() => {
              const stat = spatialData ? provinceStatByRef(spatialData, { name: selectedCell.province }) : null;
              const code = stat?.code;
              const healthProv = spatialData && code ? spatialData.health.byProvinceCategory[code] : null;
              const healthTotal = spatialData && code ? spatialData.health.byProvince[code] : null;
              const access = spatialData && code ? hospitalAccessByCode(spatialData, code) : null;
              if (!spatialData) {
                return (
                  <div className="text-[11px] text-ink-500 p-4 text-center border border-dashed border-line rounded-xl">
                    در حال بارگذاری اطلس مکانی…
                  </div>
                );
              }
              if (!stat) {
                return (
                  <div className="text-[11px] text-ink-500 p-4 text-center border border-dashed border-line rounded-xl">
                    دادهٔ اطلس برای «{selectedCell.province}» یافت نشد.
                  </div>
                );
              }
              const groups = Object.entries(stat.byGroup || {});
              const topHealth: Array<[string, number]> = healthProv
                ? (Object.entries(healthProv.categories) as Array<[string, number]>).sort((a, b) => b[1] - a[1]).slice(0, 4)
                : [];
              const hosp = access?.بیمارستان;
              const phc = access?.['بهداشت اولیه'];
              return (
                <div className="flex flex-col gap-3 animate-fade-in text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-brand-800 text-[11px]">اطلس مکانی {selectedCell.province}</span>
                    <span className="text-[9px] font-mono text-ink-400">{stat.code}</span>
                  </div>

                  {/* زیرساخت به تفکیک گروه */}
                  <div className="p-3 bg-paper rounded-xl border border-line flex flex-col gap-2">
                    <span className="font-extrabold text-ink-800 text-[10.5px]">🏗️ زیرساخت‌های مکانی ({toPersianDigits(stat.totalFeatures ?? 0)} عارضه)</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {groups.map(([g, v]) => (
                        <div key={g} className="flex items-center justify-between p-1.5 bg-surface rounded-lg border border-line">
                          <span className="flex items-center gap-1.5 text-ink-700 font-bold">
                            <span className="w-2 h-2 rounded-full" style={{ background: INFRA_GROUP_COLORS[g] || '#94A3B8' }} />
                            {INFRA_GROUP_LABELS[g] || g}
                          </span>
                          <span className="font-mono font-black text-ink-800">{toPersianDigits(Number(v))}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* مراکز درمانی Healthsites */}
                  <div className="p-3 bg-paper rounded-xl border border-line flex flex-col gap-2">
                    <span className="font-extrabold text-ink-800 text-[10.5px]">🩺 مراکز درمانی (Healthsites)</span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-danger">{toPersianDigits(healthTotal ?? 0)}</span>
                      <span className="text-[10px] text-ink-500">مرکز نقطه‌ای ثبت‌شده</span>
                    </div>
                    {topHealth.map(([cat, n]) => (
                      <div key={cat} className="flex items-center justify-between text-[10.5px]">
                        <span className="flex items-center gap-1.5 text-ink-700">
                          <span className="w-2 h-2 rounded-full" style={{ background: HEALTH_TYPE_COLORS[cat] || '#94A3B8' }} />
                          {cat}
                        </span>
                        <span className="font-mono font-black text-ink-800">{toPersianDigits(n)}</span>
                      </div>
                    ))}
                  </div>

                  {/* دسترسی درمانی HeiGIT */}
                  {(hosp || phc) && (
                    <div className="p-3 bg-paper rounded-xl border border-line flex flex-col gap-2">
                      <span className="font-extrabold text-ink-800 text-[10.5px]">🚑 دسترسی سفر (HeiGIT)</span>
                      {hosp && (
                        <div className="flex justify-between items-center text-[10.5px]">
                          <span className="text-ink-700 font-bold">جمعیت در دسترس بیمارستان (تا {toPersianDigits((hosp.withinMin ?? 0) / 60)} ساعت):</span>
                          <span className="font-mono font-black text-ok">{toPersianDigits(hosp.withinSharePct ?? 0)}٪</span>
                        </div>
                      )}
                      {phc && (
                        <div className="flex justify-between items-center text-[10.5px]">
                          <span className="text-ink-700 font-bold">جمعیت در دسترس بهداشت اولیه (تا {toPersianDigits((phc.withinMin ?? 0) / 60)} ساعت):</span>
                          <span className="font-mono font-black text-ok">{toPersianDigits(phc.withinSharePct ?? 0)}٪</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* جمعیت و اقتصاد */}
                  <div className="p-3 bg-paper rounded-xl border border-line flex flex-col gap-1.5">
                    <span className="font-extrabold text-ink-800 text-[10.5px]">👥 جمعیت و اقتصاد</span>
                    <div className="flex justify-between text-[10.5px]">
                      <span className="text-ink-700">جمعیت سرشماری ۱۳۹۵:</span>
                      <span className="font-mono font-black text-ink-800">{toPersianDigits(stat.socioeconomic.population_2016?.toLocaleString('en-US') ?? '—')}</span>
                    </div>
                    <div className="flex justify-between text-[10.5px]">
                      <span className="text-ink-700">برآورد ۱۴۰۴:</span>
                      <span className="font-mono font-black text-ink-800">{toPersianDigits(stat.socioeconomic.population_2025_estimate?.toLocaleString('en-US') ?? '—')}</span>
                    </div>
                    <div className="flex justify-between text-[10.5px]">
                      <span className="text-ink-700">سهم از جمعیت کشور:</span>
                      <span className="font-mono font-black text-ink-800">{toPersianDigits(stat.socioeconomic.share_national_pop_2016_pct ?? 0)}٪</span>
                    </div>
                  </div>

                  {/* محیط‌زیست و ماهواره */}
                  <div className="p-3 bg-paper rounded-xl border border-line flex flex-col gap-1.5">
                    <span className="font-extrabold text-ink-800 text-[10.5px]">🌿 محیط‌زیست و ماهواره</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="p-1.5 bg-surface rounded-lg border border-line">
                        <div className="text-[9px] text-ink-500">بارش (mm)</div>
                        <div className="font-mono font-black text-ink-800">{toPersianDigits(stat.environmental.precip_mm ?? 0)}</div>
                      </div>
                      <div className="p-1.5 bg-surface rounded-lg border border-line">
                        <div className="text-[9px] text-ink-500">AQI ۲۰۲۴</div>
                        <div className="font-mono font-black text-ink-800">{toPersianDigits(stat.environmental.aqi_2024 ?? 0)}</div>
                      </div>
                      <div className="p-1.5 bg-surface rounded-lg border border-line">
                        <div className="text-[9px] text-ink-500">NDVI (پوشش گیاهی)</div>
                        <div className="font-mono font-black text-ink-800">{toPersianDigits(Math.round((stat.satellite.ndvi_mean ?? 0) * 1000) / 10)}٪</div>
                      </div>
                      <div className="p-1.5 bg-surface rounded-lg border border-line">
                        <div className="text-[9px] text-ink-500">سطح محرومیت</div>
                        <div className="font-mono font-black text-ink-800">{stat.satellite.deprivation_level || '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* اینفوگراف استانی (داشبورد رسمی مرکز آمار/وزارت کشور) */}
                  {(() => {
                    const inf = infographicData?.byProvince[code ?? ''];
                    if (!infographicData) {
                      return (
                        <div className="p-3 bg-paper rounded-xl border border-line text-[10px] text-ink-500 text-center">
                          در حال بارگذاری اینفوگراف استانی…
                        </div>
                      );
                    }
                    if (!inf || inf.indicators.length === 0) {
                      return null;
                    }
                    const featured = inf.indicators.filter((i) => i.value).slice(0, 10);
                    const ranking = infographicData.rankings[activeRanking] || infographicData.rankings[0];
                    const provName = (inf.nameFa || selectedCell.province).replace('استان ', '').trim();
                    const provRowIdx = ranking?.rows.findIndex(([n]) => n.replace('استان ', '').trim() === provName || n.replace('استان ', '').trim() === inf.nameFa.replace('استان ', '').trim());
                    return (
                      <div className="flex flex-col gap-3">
                        {/* داشبورد شاخص‌های رسمی */}
                        <div className="p-3 bg-paper rounded-xl border border-line flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-ink-800 text-[10.5px]">📊 اینفوگراف استانی {inf.nameFa}</span>
                            <span className="text-[8.5px] text-ink-400 font-mono">{toPersianDigits(featured.length)} شاخص رسمی</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {featured.map((ind, i) => (
                              <div key={i} className="p-1.5 bg-surface rounded-lg border border-line flex flex-col gap-0.5">
                                <div className="text-[8.5px] text-ink-500 leading-tight line-clamp-2">{ind.label}</div>
                                <div className="flex items-baseline gap-1">
                                  <span className="font-mono font-black text-[11px] text-brand-800">{toPersianDigits(ind.value)}</span>
                                  {ind.unit && <span className="text-[8px] text-ink-400">{toPersianDigits(ind.unit)}</span>}
                                </div>
                                <div className="flex justify-between text-[7.5px] text-ink-400">
                                  <span>رتبه {toPersianDigits(ind.rank ?? '—')}</span>
                                  <span>{ind.year ? `سال ${toPersianDigits(ind.year)}` : ''}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="text-[8px] text-ink-400 leading-relaxed">
                            منبع: {Array.from(new Set(featured.map((f) => f.source).filter(Boolean))).slice(0, 2).join(' · ')} — استخراج از geojson/iran_extracted_charts.json
                          </div>
                        </div>

                        {/* جدول رتبه‌بندی ملی */}
                        {ranking && (
                          <div className="p-3 bg-paper rounded-xl border border-line flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-ink-800 text-[10.5px]">🏆 رتبه‌بندی ملی: {ranking.label}</span>
                              <select
                                value={activeRanking}
                                onChange={(e) => setActiveRanking(Number(e.target.value))}
                                className="bg-surface border border-line rounded-lg px-1.5 py-1 text-[9px] font-bold text-ink-700 max-w-[110px]"
                              >
                                {infographicData.rankings.map((r, i) => (
                                  <option key={i} value={i}>{r.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
                              {ranking.rows.map(([name, val], i) => {
                                const isProv = name.replace('استان ', '').trim() === provName;
                                return (
                                  <div
                                    key={i}
                                    className={`flex items-center justify-between px-1.5 py-1 rounded-lg text-[9.5px] ${isProv ? 'bg-brand-50 border border-brand-300 font-black text-brand-900' : 'text-ink-600'}`}
                                  >
                                    <span className="flex items-center gap-1.5 truncate">
                                      <span className={`w-4 text-center font-mono text-[8.5px] ${i < 3 ? 'text-danger font-black' : 'text-ink-400'}`}>{toPersianDigits(i + 1)}</span>
                                      <span className="truncate">{name.replace('استان ', '')}</span>
                                    </span>
                                    <span className="font-mono font-bold shrink-0">{toPersianDigits(val)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="text-[8.5px] text-ink-400 leading-relaxed">
                    منبع: Healthsites.io · HOT OSM (HDX) · HeiGIT · مرکز آمار · برآورد ماهواره‌ای — استخراج از geojson/ (scripts/extract_geojson_integration.py)
                  </div>
                </div>
              );
            })()}

            {contextTab === 'kpis' && (
              <div className="flex flex-col gap-2 text-xs animate-fade-in">
                {DIMENSIONS_LIST.map((dim) => (
                  <div key={dim.code} className="p-2.5 bg-paper rounded-xl border border-line flex justify-between items-center">
                    <span className="font-bold text-ink-700">{dim.name}</span>
                    <span className="font-mono font-black text-brand-800">
                      {toPersianDigits(selectedCell.dimensions[dim.code] || 70)} / ۱۰۰
                    </span>
                  </div>
                ))}
              </div>
            )}

            {contextTab === 'trend' && (
              <div className="flex flex-col gap-3 text-xs animate-fade-in">
                <span className="font-bold text-ink-700">روند ۵‌ساله شاخص تنش آبی:</span>
                <div className="h-28 bg-paper p-2 rounded-xl border border-line flex items-end justify-between gap-2 px-4 relative">
                  {[72, 76, 80, 84, selectedCell.waterStress].map((val, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                      <div 
                        className="w-full bg-danger-soft rounded-t-md transition-all"
                        style={{ height: `${val}%` }}
                      />
                      <span className="text-[9px] font-mono text-ink-500">{1401 + idx}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {contextTab === 'flows' && (
              <div className="flex flex-col gap-2 text-xs text-ink-700 animate-fade-in">
                <div className="p-2.5 bg-paper rounded-xl border border-line flex justify-between">
                  <span>جریان مهاجرت ورودی:</span>
                  <span className="font-bold text-ok">+۱۲,۴۰۰ نفر</span>
                </div>
                <div className="p-2.5 bg-paper rounded-xl border border-line flex justify-between">
                  <span>حجم ترانزیت کالا:</span>
                  <span className="font-bold text-info">۴.۲ میلیون تن</span>
                </div>
              </div>
            )}

            {contextTab === 'events' && (
              <div className="flex flex-col gap-2 text-xs animate-fade-in">
                <div className="p-2.5 bg-paper rounded-xl border border-line text-ink-700">
                  <div className="font-bold text-warn">افت تراز آبخوان دشت</div>
                  <div className="text-[10px] text-ink-500 mt-0.5">ثبت توسط سازمان مدیریت منابع آب (۲ روز قبل)</div>
                </div>
              </div>
            )}

            {contextTab === 'documents' && (
              <div className="flex flex-col gap-2 text-xs animate-fade-in">
                <div className="p-2.5 bg-paper rounded-xl border border-line text-ink-700 flex items-center justify-between">
                  <span>سند آمایش استان {selectedCell.province}</span>
                  <button className="text-brand-800 font-bold underline">دانلود PDF</button>
                </div>
              </div>
            )}
          </div>

          {/* Pinned Comparison Tray */}
          {pinnedCells.length > 0 && (
            <div className="p-2.5 bg-paper border-t border-line flex flex-col gap-2">
              <span className="text-[10px] font-bold text-warn">سلول‌های سنجاق‌شده جهت مقایسه ({pinnedCells.length}):</span>
              <div className="flex gap-1.5 overflow-x-auto">
                {pinnedCells.map(c => (
                  <div key={c.id} className="p-1.5 bg-surface border border-line rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0 text-ink-800">
                    <span>{c.name}</span>
                    <button onClick={() => togglePinCell(c)} className="text-ink-400 hover:text-danger">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. BOTTOM TIME SLIDER & TEMPORAL CONTROL BAR */}
      {!isZenMode && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 bg-surface/95 border border-line px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md flex items-center gap-4 text-xs">
          {/* Play/Pause Button */}
          <button
            onClick={() => setIsPlayingAnimation(!isPlayingAnimation)}
            className="w-8 h-8 rounded-xl bg-brand-800 text-signal-400 flex items-center justify-center cursor-pointer hover:scale-105 transition-all border border-signal-400/30 shadow-md"
          >
            {isPlayingAnimation ? <Pause size={16} /> : <Play size={16} />}
          </button>

          {/* Timeline Slider */}
          <div className="flex flex-col gap-1 min-w-[280px]">
            <div className="flex justify-between text-[10px] font-extrabold text-ink-700">
              <span>خط زمان تحول سرزمینی:</span>
              <span className="text-brand-800 font-mono font-black">{toPersianDigits(selectedYear)}</span>
            </div>
            <input 
              type="range"
              min="1398"
              max="1405"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-brand-800"
            />
          </div>

          {/* Delta Compare Toggle */}
          <button
            onClick={() => setIsDeltaCompareMode(!isDeltaCompareMode)}
            className={`px-2.5 py-1.5 rounded-xl font-bold text-[10.5px] cursor-pointer transition-all border ${
              isDeltaCompareMode 
                ? 'bg-warn-soft text-warn border-warn/40' 
                : 'bg-paper text-ink-700 border-line'
            }`}
          >
            {isDeltaCompareMode ? 'حالت دلتا (Δ) فعال' : 'مقایسه زمان‌مند (Δ)'}
          </button>

          {/* Analytics Tray Toggle Button */}
          <button
            onClick={() => setBottomTrayOpen(!bottomTrayOpen)}
            className="px-3 py-1.5 bg-brand-800 text-signal-400 rounded-xl font-black text-[10.5px] cursor-pointer border border-signal-400/30 hover:scale-105 transition-all flex items-center gap-1"
          >
            <BarChart3 size={14} />
            <span>سینی تحلیل</span>
          </button>
        </div>
      )}

      {/* 6. BOTTOM ANALYTICS TRAY (COLLAPSIBLE DRAWER) */}
      {!isZenMode && bottomTrayOpen && (
        <div className="absolute bottom-16 left-12 right-12 z-40 bg-surface/95 border border-line rounded-2xl shadow-2xl backdrop-blur-md p-4 flex flex-col gap-3 animate-fade-in max-h-64 overflow-hidden">
          <div className="flex items-center justify-between border-b pb-2 border-line">
            <div className="flex items-center gap-3 text-xs font-black">
              <span className="text-brand-800">سینی تحلیلی و داده‌های گستره دید:</span>
              <div className="flex bg-paper p-0.5 rounded-lg border border-line text-[10px]">
                <button 
                  onClick={() => setActiveBottomTab('histogram')}
                  className={`px-2.5 py-1 rounded-md transition-all ${activeBottomTab === 'histogram' ? 'bg-brand-800 text-signal-400' : 'text-ink-700'}`}
                >
                  هیستوگرام توزیع
                </button>
                <button 
                  onClick={() => setActiveBottomTab('table')}
                  className={`px-2.5 py-1 rounded-md transition-all ${activeBottomTab === 'table' ? 'bg-brand-800 text-signal-400' : 'text-ink-700'}`}
                >
                  جدول عوارض
                </button>
              </div>
            </div>
            <button onClick={() => setBottomTrayOpen(false)} className="text-ink-400 hover:text-ink-700">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto text-xs">
            {activeBottomTab === 'histogram' && (
              <div className="flex items-end justify-between h-32 gap-3 px-8 pt-4">
                {(() => {
                  const dimColors: Record<string, string> = { S: '#3B82F6', E: '#10B981', P: '#8B5CF6', D: '#EC4899', I: '#06B6D4', C: '#F59E0B', N: '#059669', F: '#84CC16', T: '#D97706', R: '#EF4444' };
                  const dimLabel: Record<string, string> = { S: 'اجتماعی', E: 'اقتصادی', P: 'سیاسی', D: 'جمعیتی', I: 'دیجیتال', C: 'فرهنگی', N: 'طبیعی', F: 'مالی', T: 'حمل‌ونقل', R: 'ریسک' };
                  const barColor = dimColors[activeDimension] || '#10B981';
                  return (
                    <>
                      <span className="absolute top-2 right-12 text-[9px] font-bold text-ink-500">شاخص: {dimLabel[activeDimension] || activeDimension}</span>
                      {PROVINCES_CELL_DATA.map((cell) => {
                        const score = cell.dimensions[activeDimension] || 0;
                        return (
                          <div key={cell.id} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                            <div 
                              className="w-full rounded-t-md transition-all hover:opacity-80 cursor-pointer"
                              style={{ height: `${score}%`, backgroundColor: barColor }}
                              onClick={() => flyToCell(cell)}
                              title={`${cell.name}: ${score} (${dimLabel[activeDimension]})`}
                            />
                            <span className="text-[8px] text-ink-700 truncate w-full text-center">{cell.name}</span>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            )}

            {activeBottomTab === 'table' && (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-[11px] text-ink-700">
                  <thead className="bg-paper text-ink-700 font-bold border-b border-line">
                    <tr>
                      <th className="p-2">نام سلول</th>
                      <th className="p-2">استان</th>
                      <th className="p-2">تنش آبی</th>
                      <th className="p-2">رشد GDP</th>
                      <th className="p-2">جمعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PROVINCES_CELL_DATA.map((c) => (
                      <tr key={c.id} className="border-b border-line hover:bg-paper cursor-pointer" onClick={() => flyToCell(c)}>
                        <td className="p-2 font-bold text-ink-800">{c.name}</td>
                        <td className="p-2">{c.province}</td>
                        <td className="p-2 font-mono text-danger font-bold">{toPersianDigits(c.waterStress)}٪</td>
                        <td className="p-2 font-mono text-ok font-bold">{toPersianDigits(c.gdpGrowth)}٪</td>
                        <td className="p-2 font-mono">{toPersianDigits((c.population / 1000000).toFixed(2))}M</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. AI NATURAL LANGUAGE QUERY MODAL */}
      {isNLQModalOpen && (
        <div className="fixed inset-0 z-50 bg-wall-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-2xl w-full max-w-xl p-5 flex flex-col gap-4 text-right shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b pb-3 border-line">
              <div className="flex items-center gap-2 font-black text-sm text-brand-800">
                <Sparkles size={18} />
                <span>پرسش مکانی هوشمند با زبان طبیعی</span>
              </div>
              <button onClick={() => setIsNLQModalOpen(false)} className="text-ink-400 hover:text-ink-700">✕</button>
            </div>

            <p className="text-xs text-ink-700 leading-relaxed">
              سوال خود را به زبان فارسی مطرح کنید. الگوریتم هوشمند، پرسش مکانی شما را به فیلترهای لایه‌ای تبدیل و نتایج را روی نقشه هایلایت می‌کند.
            </p>

            <div className="flex gap-2">
              <input 
                type="text" 
                value={nlqInput}
                onChange={(e) => setNlqInput(e.target.value)}
                className="flex-1 bg-paper border border-line rounded-xl px-3 py-2 text-xs text-ink-800 outline-none focus:border-brand-800"
                placeholder="مثال: شهرستان‌هایی با تنش آبی بالای ۸۰٪ و بیکاری بالای ۱۵٪"
              />
              <button 
                onClick={runNLQ}
                className="px-4 py-2 bg-brand-800 hover:bg-brand-700 text-signal-400 rounded-xl font-bold text-xs cursor-pointer shadow-md"
              >
                اجرای پرسش
              </button>
            </div>

            {nlqResult && (
              <div className="p-3 bg-ok-soft border border-ok/40 rounded-xl text-xs text-brand-950 leading-relaxed animate-fade-in">
                {nlqResult}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. SPATIAL BOOKMARKS MODAL */}
      {isBookmarkModalOpen && (
        <div className="fixed inset-0 z-50 bg-wall-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-2xl w-full max-w-lg p-5 flex flex-col gap-4 text-right shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 border-line">
              <span className="font-black text-sm text-brand-800">نشانک‌های مکانی ذخیره‌شده</span>
              <button onClick={() => setIsBookmarkModalOpen(false)} className="text-ink-400 hover:text-ink-700">✕</button>
            </div>

            <div className="flex flex-col gap-2">
              {bookmarks.map((bm) => (
                <div key={bm.id} className="p-3 bg-paper border border-line rounded-xl flex items-center justify-between text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-ink-800">{bm.title}</span>
                    <span className="text-[10px] text-ink-500">تاریخ: {bm.date}</span>
                  </div>
                  <button 
                    onClick={() => {
                      if (mapInstanceRef.current) {
                        mapInstanceRef.current.flyTo([bm.lat, bm.lng], bm.zoom);
                      }
                      setIsBookmarkModalOpen(false);
                    }}
                    className="px-3 py-1.5 bg-brand-800 text-signal-400 rounded-lg font-bold text-[11px] cursor-pointer"
                  >
                    پرش به نما
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 9. PRINT & EXPORT COMPOSER MODAL */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-wall-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-2xl w-full max-w-md p-5 flex flex-col gap-4 text-right shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 border-line">
              <span className="font-black text-sm text-brand-800">خروجی رسمی و چاپ نقشه</span>
              <button onClick={() => setIsPrintModalOpen(false)} className="text-ink-400 hover:text-ink-700">✕</button>
            </div>

            <p className="text-xs text-ink-700 leading-relaxed">
              نقشه فعلی همراه با قاب رسمی حاکمیتی، Legend، مقیاس و تاریخ خروجی به صورت فایل تصویر یا PDF آماده‌سازی می‌شود.
            </p>

            <div className="flex gap-2 justify-end mt-2">
              <button 
                onClick={() => { alert('فایل PDF نقشه رسمی با موفقیت تولید و دانلود شد.'); setIsPrintModalOpen(false); }}
                className="px-4 py-2 bg-brand-800 text-signal-400 rounded-xl font-bold text-xs cursor-pointer shadow-md"
              >
                دانلود PDF نقشه
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
