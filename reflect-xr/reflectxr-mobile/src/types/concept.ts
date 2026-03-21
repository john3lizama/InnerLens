export interface Concept {
  id: string;
  title: string;
  slug: string;
  prompt_template: string;
  dropdown_label: string;
  dropdown_options: string[];
  reflection_prompt: string;
  category: string;
}

export interface DropdownOption {
  label: string;
  value: string;
}
