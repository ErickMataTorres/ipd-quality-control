import { computed, inject, Injectable, signal } from '@angular/core';
import { Session, User } from '@supabase/supabase-js';

import { SupabaseService } from '../services/supabase';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabase = inject(SupabaseService);

  readonly session = signal<Session | null>(null);

  readonly user = computed<User | null>(
    () => this.session()?.user ?? null,
  );

  readonly isAuthenticated = computed(
    () => this.session() !== null,
  );

  constructor() {
    this.supabase.client.auth.onAuthStateChange(
      (_event, session) => {
        this.session.set(session);
      },
    );
  }

  async getSession(): Promise<Session | null> {
    const { data, error } =
      await this.supabase.client.auth.getSession();

    if (error) {
      throw error;
    }

    this.session.set(data.session);

    return data.session;
  }

  async signIn(
    employeeNumber: string,
    password: string,
  ): Promise<void> {
    const normalizedEmployeeNumber =
      employeeNumber.trim().toLowerCase();

    const technicalEmail =
      `${normalizedEmployeeNumber}@ipd.contec.internal`;

    const { data, error } =
      await this.supabase.client.auth.signInWithPassword({
        email: technicalEmail,
        password,
      });

    if (error) {
      throw error;
    }

    this.session.set(data.session);
  }

  async signOut(): Promise<void> {
    const { error } =
      await this.supabase.client.auth.signOut({
        scope: 'local',
      });

    if (error) {
      throw error;
    }

    this.session.set(null);
  }
}
