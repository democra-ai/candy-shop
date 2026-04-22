import axios, { type AxiosInstance } from 'axios';
import type { 
  Skill, 
  AnalysisResult, 
  UploadResult, 
  ExecutionResult,
  SkillFilter 
} from '../types/skill-creator';

// Default to same-origin `/api` so the bundle never ships a hardcoded
// `http://localhost:3000` — that triggers Safari's "Access other apps and
// services on this device" (Local Network Access) prompt in production.
// Override with VITE_API_BASE_URL if the skill-creator API lives elsewhere.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token interceptor
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // File Upload
  async uploadFiles(files: File[]): Promise<UploadResult> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await this.client.post<UploadResult>(
      '/skills/create/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  // Analyze Files
  async analyzeFiles(fileIds: string[]): Promise<{ jobId: string }> {
    const response = await this.client.post('/skills/create/analyze', {
      fileIds,
    });
    return response.data;
  }

  // Get Analysis Status
  async getAnalysisStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    result?: AnalysisResult;
    error?: string;
  }> {
    const response = await this.client.get(`/skills/create/status/${jobId}`);
    return response.data;
  }

  // Generate Skill
  async generateSkill(
    analysisResult: AnalysisResult,
    preferences?: { name?: string; category?: string; capabilities?: string[] }
  ): Promise<Skill> {
    const response = await this.client.post<Skill>('/skills/create/generate', {
      analysisResult,
      preferences,
    });
    return response.data;
  }

  // Save Skill
  async saveSkill(skill: Partial<Skill>): Promise<Skill> {
    const response = await this.client.post<Skill>('/skills', skill);
    return response.data;
  }

  // Get User Skills
  async getUserSkills(filter?: SkillFilter): Promise<Skill[]> {
    const response = await this.client.get<Skill[]>('/skills', {
      params: filter,
    });
    return response.data;
  }

  // Get Skill by ID
  async getSkill(skillId: string): Promise<Skill> {
    const response = await this.client.get<Skill>(`/skills/${skillId}`);
    return response.data;
  }

  // Update Skill
  async updateSkill(skillId: string, updates: Partial<Skill>): Promise<Skill> {
    const response = await this.client.put<Skill>(`/skills/${skillId}`, updates);
    return response.data;
  }

  // Delete Skill
  async deleteSkill(skillId: string): Promise<void> {
    await this.client.delete(`/skills/${skillId}`);
  }

  // Execute Skill
  async executeSkill(skillId: string, input: string): Promise<ExecutionResult> {
    const response = await this.client.post<ExecutionResult>(
      `/skills/${skillId}/execute`,
      { input }
    );
    return response.data;
  }

  // Get Execution History
  async getExecutionHistory(skillId: string): Promise<ExecutionResult[]> {
    const response = await this.client.get<ExecutionResult[]>(
      `/skills/${skillId}/history`
    );
    return response.data;
  }
}

export const apiClient = new ApiClient();
