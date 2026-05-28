import {
  FileText,
  Shield,
  AlertTriangle,
  ClipboardCheck,
  Target,
  Apple,
  Activity,
  Phone,
  Camera,
  Lock,
  type LucideIcon,
} from "lucide-react";

export interface FormField {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox" | "radio" | "date" | "number" | "email" | "tel";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  rows?: number;
}

export interface FormTemplate {
  type: string;
  title: string;
  description: string;
  icon: LucideIcon;
  fields: FormField[];
  requiresSignature: boolean;
}

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    type: "parq",
    title: "PAR-Q+ Health Questionnaire",
    description: "Physical Activity Readiness Questionnaire to ensure safe participation in exercise programs",
    icon: FileText,
    requiresSignature: true,
    fields: [
      { name: "has_heart_condition", label: "Has your doctor ever said you have a heart condition?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { name: "chest_pain_activity", label: "Do you feel pain in your chest during physical activity?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { name: "chest_pain_no_activity", label: "Do you feel chest pain when not doing physical activity?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { name: "lose_balance", label: "Do you lose balance because of dizziness?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { name: "bone_joint_problem", label: "Do you have a bone or joint problem that could be worsened by exercise?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { name: "blood_pressure_medication", label: "Do you currently take blood pressure or heart medication?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { name: "other_reason", label: "Any other reason you should not participate in physical activity?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { name: "medical_conditions", label: "List any current medical conditions, injuries, or surgeries", type: "textarea", rows: 3 },
      { name: "medications", label: "List all current medications", type: "textarea", rows: 2 },
    ],
  },
  {
    type: "consent",
    title: "Informed Consent Form",
    description: "Acknowledges understanding of training programs and associated risks",
    icon: Shield,
    requiresSignature: true,
    fields: [
      { name: "understand_program", label: "I understand the training program includes various forms of physical exercise", type: "checkbox", required: true },
      { name: "understand_risks", label: "I understand there are inherent risks including injury, muscle strains, and in rare cases more serious injury", type: "checkbox", required: true },
      { name: "voluntary_participation", label: "I am participating voluntarily and accept all risks", type: "checkbox", required: true },
      { name: "medical_clearance", label: "I have been cleared by my physician to participate in an exercise program", type: "checkbox", required: true },
      { name: "emergency_treatment", label: "I authorize emergency medical treatment if needed", type: "checkbox", required: true },
      { name: "acknowledge_policies", label: "I acknowledge the cancellation and scheduling policies", type: "checkbox", required: true },
    ],
  },
  {
    type: "liability",
    title: "Liability Waiver & Release",
    description: "Legal waiver releasing Cooper Fitness from liability for injuries during training",
    icon: AlertTriangle,
    requiresSignature: true,
    fields: [
      { name: "full_legal_name", label: "Full Legal Name", type: "text", required: true },
      { name: "date_of_birth", label: "Date of Birth", type: "date", required: true },
      { name: "release_liability", label: "I voluntarily assume all risks and release Cooper Fitness, its owners, employees, and agents from any and all liability", type: "checkbox", required: true },
      { name: "waive_claims", label: "I waive any claims I might have against Cooper Fitness for injury or damages", type: "checkbox", required: true },
      { name: "indemnify", label: "I agree to indemnify and hold harmless Cooper Fitness from any claims arising from my participation", type: "checkbox", required: true },
      { name: "photo_release", label: "I grant permission for photos/videos taken during training to be used for promotional purposes", type: "checkbox" },
      { name: "acknowledge_read", label: "I have read and understood this entire waiver", type: "checkbox", required: true },
    ],
  },
  {
    type: "agreement",
    title: "Coaching Agreement",
    description: "Terms of service, payment details, and coaching program expectations",
    icon: ClipboardCheck,
    requiresSignature: true,
    fields: [
      { name: "program_type", label: "Selected Program", type: "select", required: true, options: [
        { value: "one_on_one", label: "1-on-1 Coaching" },
        { value: "group", label: "Group Coaching" },
        { value: "online", label: "Online Coaching" },
        { value: "hybrid", label: "Hybrid (In-Person + Online)" },
      ]},
      { name: "session_frequency", label: "Preferred Session Frequency", type: "select", required: true, options: [
        { value: "1x_week", label: "1x per week" },
        { value: "2x_week", label: "2x per week" },
        { value: "3x_week", label: "3x per week" },
        { value: "custom", label: "Custom schedule" },
      ]},
      { name: "agree_to_payment", label: "I agree to the payment terms and understand fees are non-refundable after the session has been delivered", type: "checkbox", required: true },
      { name: "cancellation_policy", label: "I understand the 24-hour cancellation policy and that late cancellations will be charged in full", type: "checkbox", required: true },
      { name: "commitment_duration", label: "I commit to the initial program duration discussed with my coach", type: "checkbox", required: true },
      { name: "additional_notes", label: "Any additional notes or special requests", type: "textarea", rows: 3 },
    ],
  },
  {
    type: "goals",
    title: "Goal & Lifestyle Assessment",
    description: "Comprehensive assessment of fitness goals, lifestyle, and training history",
    icon: Target,
    requiresSignature: false,
    fields: [
      { name: "primary_goal", label: "Primary Fitness Goal", type: "select", required: true, options: [
        { value: "weight_loss", label: "Weight Loss" },
        { value: "muscle_gain", label: "Muscle Gain" },
        { value: "strength", label: "Strength" },
        { value: "endurance", label: "Endurance" },
        { value: "flexibility", label: "Flexibility / Mobility" },
        { value: "sport_specific", label: "Sport-Specific Training" },
        { value: "general_fitness", label: "General Fitness" },
        { value: "rehabilitation", label: "Rehabilitation" },
      ]},
      { name: "secondary_goals", label: "Secondary Goals (if any)", type: "text" },
      { name: "target_timeline", label: "Target Timeline", type: "select", options: [
        { value: "1_month", label: "1 Month" },
        { value: "3_months", label: "3 Months" },
        { value: "6_months", label: "6 Months" },
        { value: "1_year", label: "1 Year" },
        { value: "ongoing", label: "Ongoing" },
      ]},
      { name: "training_experience", label: "Training Experience", type: "select", required: true, options: [
        { value: "beginner", label: "Beginner (0-1 years)" },
        { value: "intermediate", label: "Intermediate (1-3 years)" },
        { value: "advanced", label: "Advanced (3+ years)" },
      ]},
      { name: "current_activity", label: "Current Physical Activity Level", type: "select", required: true, options: [
        { value: "sedentary", label: "Sedentary" },
        { value: "lightly_active", label: "Lightly Active" },
        { value: "moderately_active", label: "Moderately Active" },
        { value: "very_active", label: "Very Active" },
      ]},
      { name: "work_schedule", label: "Work Schedule / Availability", type: "textarea", rows: 2 },
      { name: "sleep_hours", label: "Average Hours of Sleep Per Night", type: "number" },
      { name: "stress_level", label: "Stress Level (1-10)", type: "number" },
      { name: "past_injuries", label: "Past Injuries or Physical Limitations", type: "textarea", rows: 2 },
      { name: "exercise_preferences", label: "Preferred Types of Exercise", type: "text" },
      { name: "exercise_dislikes", label: "Exercises You Dislike or Cannot Do", type: "text" },
    ],
  },
  {
    type: "nutrition",
    title: "Nutrition Questionnaire",
    description: "Dietary habits, preferences, allergies, and nutrition goals",
    icon: Apple,
    requiresSignature: false,
    fields: [
      { name: "meals_per_day", label: "How Many Meals Do You Eat Per Day?", type: "number", required: true },
      { name: "snacking", label: "How Often Do You Snack Between Meals?", type: "select", options: [
        { value: "never", label: "Never" },
        { value: "rarely", label: "Rarely" },
        { value: "sometimes", label: "Sometimes" },
        { value: "often", label: "Often" },
        { value: "daily", label: "Daily" },
      ]},
      { name: "water_intake", label: "Daily Water Intake (glasses)", type: "number" },
      { name: "diet_type", label: "Current Diet Type", type: "select", options: [
        { value: "no_restrictions", label: "No Restrictions" },
        { value: "vegetarian", label: "Vegetarian" },
        { value: "vegan", label: "Vegan" },
        { value: "keto", label: "Keto" },
        { value: "paleo", label: "Paleo" },
        { value: "gluten_free", label: "Gluten-Free" },
        { value: "other", label: "Other" },
      ]},
      { name: "food_allergies", label: "Food Allergies or Intolerances", type: "text" },
      { name: "supplements", label: "Current Supplements", type: "text" },
      { name: "alcohol_consumption", label: "Alcohol Consumption", type: "select", options: [
        { value: "none", label: "None" },
        { value: "occasional", label: "Occasional (1-2/week)" },
        { value: "moderate", label: "Moderate (3-5/week)" },
        { value: "heavy", label: "Heavy (daily)" },
      ]},
      { name: "cooking_frequency", label: "How Often Do You Cook at Home?", type: "select", options: [
        { value: "never", label: "Never" },
        { value: "rarely", label: "Rarely" },
        { value: "sometimes", label: "Sometimes" },
        { value: "usually", label: "Usually" },
        { value: "always", label: "Always" },
      ]},
      { name: "nutrition_goals", label: "Nutrition Goals", type: "textarea", rows: 2 },
      { name: "biggest_challenge", label: "Biggest Nutrition Challenge", type: "textarea", rows: 2 },
    ],
  },
  {
    type: "progress",
    title: "Progress & Baseline Assessment",
    description: "Baseline measurements, photos, and fitness benchmarks for tracking progress",
    icon: Activity,
    requiresSignature: false,
    fields: [
      { name: "current_weight", label: "Current Weight (lbs)", type: "number", required: true },
      { name: "height", label: "Height (inches)", type: "number", required: true },
      { name: "target_weight", label: "Target Weight (lbs)", type: "number" },
      { name: "body_fat_percentage", label: "Body Fat % (if known)", type: "number" },
      { name: "chest_measurement", label: "Chest (inches)", type: "number" },
      { name: "waist_measurement", label: "Waist (inches)", type: "number" },
      { name: "hip_measurement", label: "Hips (inches)", type: "number" },
      { name: "bicep_measurement", label: "Bicep (inches)", type: "number" },
      { name: "thigh_measurement", label: "Thigh (inches)", type: "number" },
      { name: "max_pushups", label: "Max Push-Ups in 1 Minute", type: "number" },
      { name: "max_plank", label: "Max Plank Hold (seconds)", type: "number" },
      { name: "mile_time", label: "1-Mile Run/Walk Time", type: "text" },
      { name: "flexibility_test", label: "Can You Touch Your Toes?", type: "select", options: [
        { value: "yes_easily", label: "Yes, easily" },
        { value: "barely", label: "Barely" },
        { value: "no", label: "No" },
      ]},
      { name: "additional_notes", label: "Additional Notes", type: "textarea", rows: 2 },
    ],
  },
  {
    type: "emergency",
    title: "Emergency Contact Form",
    description: "Emergency contact information in case of injury or medical emergency",
    icon: Phone,
    requiresSignature: true,
    fields: [
      { name: "emergency_name", label: "Emergency Contact Name", type: "text", required: true },
      { name: "emergency_relationship", label: "Relationship", type: "select", required: true, options: [
        { value: "spouse", label: "Spouse" },
        { value: "parent", label: "Parent" },
        { value: "sibling", label: "Sibling" },
        { value: "friend", label: "Friend" },
        { value: "other", label: "Other" },
      ]},
      { name: "emergency_phone", label: "Emergency Contact Phone", type: "tel", required: true },
      { name: "emergency_email", label: "Emergency Contact Email", type: "email" },
      { name: "secondary_emergency_name", label: "Secondary Emergency Contact Name", type: "text" },
      { name: "secondary_emergency_phone", label: "Secondary Emergency Contact Phone", type: "tel" },
      { name: "blood_type", label: "Blood Type (if known)", type: "select", options: [
        { value: "unknown", label: "Unknown" },
        { value: "a_pos", label: "A+" },
        { value: "a_neg", label: "A-" },
        { value: "b_pos", label: "B+" },
        { value: "b_neg", label: "B-" },
        { value: "ab_pos", label: "AB+" },
        { value: "ab_neg", label: "AB-" },
        { value: "o_pos", label: "O+" },
        { value: "o_neg", label: "O-" },
      ]},
      { name: "allergies", label: "Allergies (medications, foods, etc.)", type: "textarea", rows: 2 },
      { name: "insurance_provider", label: "Health Insurance Provider", type: "text" },
      { name: "insurance_policy", label: "Policy Number", type: "text" },
    ],
  },
  {
    type: "media",
    title: "Media Release Consent",
    description: "Permission to use photos and videos for marketing and social media",
    icon: Camera,
    requiresSignature: true,
    fields: [
      { name: "grant_permission", label: "I grant Cooper Fitness permission to photograph and/or video record me during training sessions", type: "checkbox", required: true },
      { name: "social_media_use", label: "I allow these images to be used on social media platforms (Instagram, Facebook, TikTok, etc.)", type: "checkbox" },
      { name: "website_use", label: "I allow these images to be used on the Cooper Fitness website", type: "checkbox" },
      { name: "marketing_use", label: "I allow these images to be used in marketing materials (brochures, ads, etc.)", type: "checkbox" },
      { name: "retain_rights", label: "I understand I can revoke this consent at any time by notifying Cooper Fitness in writing", type: "checkbox", required: true },
    ],
  },
  {
    type: "privacy",
    title: "Privacy Policy & Data Consent",
    description: "Consent for data collection, storage, and usage per privacy regulations",
    icon: Lock,
    requiresSignature: true,
    fields: [
      { name: "data_collection", label: "I consent to the collection of personal and health data for the purpose of providing fitness coaching services", type: "checkbox", required: true },
      { name: "data_storage", label: "I understand my data will be stored securely and used only for coaching purposes", type: "checkbox", required: true },
      { name: "data_sharing", label: "I understand my data will not be shared with third parties without my explicit consent", type: "checkbox", required: true },
      { name: "right_to_access", label: "I understand I have the right to access, correct, or delete my personal data at any time", type: "checkbox", required: true },
      { name: "communication_consent", label: "I consent to receiving email communications from Cooper Fitness", type: "checkbox" },
      { name: "read_privacy_policy", label: "I have read and understood the Privacy Policy", type: "checkbox", required: true },
    ],
  },
];

export function getFormTemplate(type: string): FormTemplate | undefined {
  return FORM_TEMPLATES.find((t) => t.type === type);
}

export function getRequiredForms(): FormTemplate[] {
  return FORM_TEMPLATES.filter((t) => t.requiresSignature);
}
