import api from './api';

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

export interface StyleOption {
  id: string;
  name: string;
  category: string;
}

export const getConcepts = async (): Promise<{ concepts: Concept[] }> => {
  const res = await api.get('/concepts');
  return res.data;
};

export const getStyles = async (): Promise<{ styles: StyleOption[] }> => {
  const res = await api.get('/concepts/styles');
  return res.data;
};
