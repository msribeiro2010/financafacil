import React, { useState } from 'react';
import FinancialSummary from '@/components/dashboard/FinancialSummary';
import AccountSetup from '@/components/dashboard/AccountSetup';
import QuickActions from '@/components/dashboard/QuickActions';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import FinancialOverview from '@/components/dashboard/FinancialOverview';
import UpcomingBills from '@/components/dashboard/UpcomingBills';
import ExpenseModal from '@/components/modals/ExpenseModal';
import IncomeModal from '@/components/modals/IncomeModal';
import AccountSettingsModal from '@/components/modals/AccountSettingsModal';
import { useQuery } from '@tanstack/react-query';

interface DashboardProps {
  userId: number;
}

export default function Dashboard({ userId }: DashboardProps) {
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [accountSettingsModalOpen, setAccountSettingsModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  
  const { data: user } = useQuery({
    queryKey: [`/api/user/${userId}`],
  });
  
  const handleAddExpense = () => {
    setSelectedTransaction(null);
    setExpenseModalOpen(true);
  };
  
  const handleAddIncome = () => {
    setSelectedTransaction(null);
    setIncomeModalOpen(true);
  };
  
  const handleEditTransaction = (transaction: any) => {
    setSelectedTransaction(transaction);
    if (transaction.type === 'expense') {
      setExpenseModalOpen(true);
    } else {
      setIncomeModalOpen(true);
    }
  };
  
  const handleEditAccountSettings = () => {
    setAccountSettingsModalOpen(true);
  };
  
  return (
    <>
      {/* Financial Summary Cards */}
      <FinancialSummary userId={userId} />
      
      {/* Account Setup */}
      <AccountSetup userId={userId} onEdit={handleEditAccountSettings} />
      
      {/* Quick Actions and Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <QuickActions onAddExpense={handleAddExpense} onAddIncome={handleAddIncome} />
        <RecentTransactions userId={userId} />
      </div>
      
      {/* Financial Overview Charts */}
      <FinancialOverview userId={userId} />
      
      {/* Upcoming Bills */}
      <UpcomingBills userId={userId} onEditTransaction={handleEditTransaction} />
      
      {/* Modals */}
      <ExpenseModal 
        isOpen={expenseModalOpen} 
        onClose={() => setExpenseModalOpen(false)} 
        userId={userId}
        transaction={selectedTransaction?.type === 'expense' ? selectedTransaction : undefined}
      />
      
      <IncomeModal 
        isOpen={incomeModalOpen} 
        onClose={() => setIncomeModalOpen(false)} 
        userId={userId}
        transaction={selectedTransaction?.type === 'income' ? selectedTransaction : undefined}
      />
      
      <AccountSettingsModal 
        isOpen={accountSettingsModalOpen} 
        onClose={() => setAccountSettingsModalOpen(false)} 
        userId={userId}
        user={user}
      />
    </>
  );
}
