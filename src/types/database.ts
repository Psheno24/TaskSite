export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          slug: string;
          title: string;
          student_name: string;
          html_content: string;
          status: Database["public"]["Enums"]["task_status"];
          teacher_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          student_name: string;
          html_content: string;
          status?: Database["public"]["Enums"]["task_status"];
          teacher_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          student_name?: string;
          html_content?: string;
          status?: Database["public"]["Enums"]["task_status"];
          teacher_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      task_answers: {
        Row: {
          id: string;
          task_id: string;
          answers: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          answers?: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          answers?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_answers_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: true;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      task_status: "not_started" | "in_progress" | "completed";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type TaskStatus = Database["public"]["Enums"]["task_status"];
