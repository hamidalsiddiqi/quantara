import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { ProtectedRoute, AdminRoute } from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import Deposit from '@/pages/Deposit';
import Withdraw from '@/pages/Withdraw';
import Cycles from '@/pages/Cycles';
import Referrals from '@/pages/Referrals';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminWithdrawals from '@/pages/admin/AdminWithdrawals';
import AdminSettings from '@/pages/admin/AdminSettings';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected user routes */}
                <Route element={<ProtectedRoute />}>
                    <Route element={<Layout />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/deposit" element={<Deposit />} />
                        <Route path="/withdraw" element={<Withdraw />} />
                        <Route path="/cycles" element={<Cycles />} />
                        <Route path="/referrals" element={<Referrals />} />

                        {/* Admin-only routes */}
                        <Route element={<AdminRoute />}>
                            <Route path="/admin/users" element={<AdminUsers />} />
                            <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
                            <Route path="/admin/settings" element={<AdminSettings />} />
                        </Route>
                    </Route>
                </Route>

                {/* Fallbacks */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
