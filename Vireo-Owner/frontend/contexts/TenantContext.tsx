import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

interface Tenant {
  tenantId: string;
  name: string;
  status: string;
  subscriptionEnd: string;
  ownerEmail: string;
}

interface TenantContextType {
  tenant: Tenant | null;
  loading: boolean;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenant = async () => {
    if (!firebaseUser) {
      setTenant(null);
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/tenant/me');
      setTenant(response.data);
    } catch (error) {
      console.error('Error fetching tenant:', error);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshTenant = async () => {
    await fetchTenant();
  };

  useEffect(() => {
    if (user) {
      fetchTenant();
    } else {
      setTenant(null);
      setLoading(false);
    }
  }, [user, firebaseUser]);

  return (
    <TenantContext.Provider value={{ tenant, loading, refreshTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
