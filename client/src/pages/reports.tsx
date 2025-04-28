import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/currency';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  PieChart, pieArcLabelClasses 
} from '@mui/x-charts/PieChart';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Cell
} from 'recharts';
import { startOfMonth, endOfMonth, format, getMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReportsProps {
  userId: number;
}

export default function Reports({ userId }: ReportsProps) {
  const [selectedChart, setSelectedChart] = useState<'expense' | 'income'>('expense');
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  
  // Get transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: [`/api/transactions/${userId}`],
  });
  
  // Get category summaries
  const { data: expenseSummary, isLoading: expenseLoading } = useQuery({
    queryKey: [`/api/category-summary/${userId}/expense`],
  });
  
  const { data: incomeSummary, isLoading: incomeLoading } = useQuery({
    queryKey: [`/api/category-summary/${userId}/income`],
  });
  
  // Get transactions from a specific month
  const getTransactionsFromMonth = (date: Date) => {
    if (!transactions) return [];
    
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    
    return transactions.filter((transaction: any) => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= start && transactionDate <= end;
    });
  };
  
  // Prepare pie chart data
  const pieChartData = React.useMemo(() => {
    const summary = selectedChart === 'expense' ? expenseSummary : incomeSummary;
    if (!summary) return [];
    
    return summary.map((category: any) => ({
      id: category.categoryId,
      value: category.total,
      label: category.name,
      color: getCategoryColor(category.categoryId)
    }));
  }, [expenseSummary, incomeSummary, selectedChart]);
  
  // Prepare monthly distribution data
  const monthlyDistributionData = React.useMemo(() => {
    if (!transactions) return [];
    
    const monthlyData: any = {};
    const today = new Date();
    
    // Get data for the last 6 months
    for (let i = 0; i < 6; i++) {
      const date = subMonths(today, i);
      const monthStr = format(date, 'yyyy-MM');
      
      monthlyData[monthStr] = {
        month: format(date, 'MMM', { locale: ptBR }),
        income: 0,
        expense: 0
      };
    }
    
    // Sum transactions by month
    transactions.forEach((transaction: any) => {
      const date = new Date(transaction.date);
      const monthStr = format(date, 'yyyy-MM');
      
      if (monthlyData[monthStr]) {
        if (transaction.type === 'income') {
          monthlyData[monthStr].income += parseFloat(transaction.amount);
        } else {
          monthlyData[monthStr].expense += parseFloat(transaction.amount);
        }
      }
    });
    
    // Convert to array and sort by date (oldest first)
    return Object.values(monthlyData).reverse();
  }, [transactions]);
  
  // Prepare category distribution by month
  const categoryDistributionByMonth = React.useMemo(() => {
    if (!transactions) return [];
    
    const monthTransactions = getTransactionsFromMonth(selectedMonth);
    
    // Group transactions by category
    const categoryData: any = {};
    
    monthTransactions.forEach((transaction: any) => {
      if (transaction.type !== selectedChart) return;
      
      const categoryId = transaction.categoryId;
      const categoryName = transaction.category?.name || 'Sem categoria';
      
      if (!categoryData[categoryId]) {
        categoryData[categoryId] = {
          category: categoryName,
          amount: 0,
          color: getCategoryColor(categoryId)
        };
      }
      
      categoryData[categoryId].amount += parseFloat(transaction.amount);
    });
    
    // Convert to array and sort by amount
    return Object.values(categoryData).sort((a: any, b: any) => b.amount - a.amount);
  }, [transactions, selectedMonth, selectedChart]);
  
  // Helper function to get colors for categories
  function getCategoryColor(categoryId: number) {
    const colors = [
      '#0891B2', // primary
      '#EF4444', // destructive
      '#16A34A', // accent
      '#F59E0B', // amber
      '#3B82F6', // blue
      '#8B5CF6', // purple
      '#EC4899', // pink
    ];
    
    return colors[categoryId % colors.length];
  }
  
  // Month selection options
  const monthOptions = React.useMemo(() => {
    const options = [];
    const today = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = subMonths(today, i);
      options.push({
        value: date.toISOString(),
        label: format(date, 'MMMM yyyy', { locale: ptBR })
      });
    }
    
    return options;
  }, []);
  
  // Calculate monthly totals
  const selectedMonthData = React.useMemo(() => {
    const monthTransactions = getTransactionsFromMonth(selectedMonth);
    let income = 0;
    let expense = 0;
    
    monthTransactions.forEach((transaction: any) => {
      const amount = parseFloat(transaction.amount);
      if (transaction.type === 'income') {
        income += amount;
      } else {
        expense += amount;
      }
    });
    
    return { income, expense, balance: income - expense };
  }, [transactions, selectedMonth]);
  
  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Relatórios Financeiros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-500">Receitas no mês</h3>
                </div>
                {transactionsLoading ? (
                  <Skeleton className="h-8 w-32 mb-2" />
                ) : (
                  <p className="text-2xl font-bold text-accent">
                    {formatCurrency(selectedMonthData.income)}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-500">Despesas no mês</h3>
                </div>
                {transactionsLoading ? (
                  <Skeleton className="h-8 w-32 mb-2" />
                ) : (
                  <p className="text-2xl font-bold text-destructive">
                    {formatCurrency(selectedMonthData.expense)}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-500">Saldo no mês</h3>
                </div>
                {transactionsLoading ? (
                  <Skeleton className="h-8 w-32 mb-2" />
                ) : (
                  <p className={`text-2xl font-bold ${selectedMonthData.balance >= 0 ? 'text-accent' : 'text-destructive'}`}>
                    {formatCurrency(selectedMonthData.balance)}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Distribuição por Categoria</CardTitle>
                  <Tabs defaultValue="expense" onValueChange={(value) => setSelectedChart(value as 'expense' | 'income')}>
                    <TabsList>
                      <TabsTrigger value="expense">Despesas</TabsTrigger>
                      <TabsTrigger value="income">Receitas</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center" style={{ height: '320px' }}>
                  {expenseLoading || incomeLoading ? (
                    <Skeleton className="h-64 w-64 rounded-full" />
                  ) : pieChartData.length > 0 ? (
                    <PieChart
                      series={[
                        {
                          data: pieChartData,
                          innerRadius: 30,
                          outerRadius: 100,
                          paddingAngle: 1,
                          cornerRadius: 4,
                          cx: 150,
                          cy: 150,
                          highlightScope: { faded: 'global', highlighted: 'item' },
                        }
                      ]}
                      height={300}
                      width={300}
                      margin={{ right: 120 }}
                      slotProps={{
                        legend: {
                          direction: 'column',
                          position: { vertical: 'middle', horizontal: 'right' },
                          itemMarkWidth: 20,
                          itemMarkHeight: 20,
                          labelStyle: {
                            fontSize: 14,
                          },
                        }
                      }}
                    />
                  ) : (
                    <div className="text-center text-slate-500">
                      <p>Sem dados disponíveis</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Evolução Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ height: '320px' }}>
                  {transactionsLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : monthlyDistributionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={monthlyDistributionData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip
                          formatter={(value) => [
                            `${formatCurrency(value as number)}`,
                            undefined
                          ]}
                        />
                        <Legend />
                        <Bar 
                          name="Receitas" 
                          dataKey="income" 
                          fill="#16A34A" 
                          stackId="a" 
                          radius={[4, 4, 0, 0]} 
                        />
                        <Bar 
                          name="Despesas" 
                          dataKey="expense" 
                          fill="#EF4444" 
                          stackId="a" 
                          radius={[4, 4, 0, 0]} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500">
                      <p>Sem dados disponíveis</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle className="text-lg">Análise Mensal Detalhada</CardTitle>
                <div className="flex flex-col md:flex-row gap-4">
                  <Select
                    value={selectedMonth.toISOString()}
                    onValueChange={(value) => setSelectedMonth(new Date(value))}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Selecione o mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Tabs defaultValue="expense" onValueChange={(value) => setSelectedChart(value as 'expense' | 'income')}>
                    <TabsList>
                      <TabsTrigger value="expense">Despesas</TabsTrigger>
                      <TabsTrigger value="income">Receitas</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div style={{ height: '300px' }}>
                  {transactionsLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : categoryDistributionByMonth.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={categoryDistributionByMonth}
                        layout="vertical"
                        margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          dataKey="category" 
                          type="category" 
                          width={100}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip 
                          formatter={(value) => [
                            `${formatCurrency(value as number)}`, 
                            undefined
                          ]}
                        />
                        <Bar 
                          dataKey="amount" 
                          name={selectedChart === 'expense' ? 'Despesas' : 'Receitas'}
                          radius={[0, 4, 4, 0]}
                        >
                          {categoryDistributionByMonth.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500">
                      <p>
                        Sem dados disponíveis para {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="overflow-auto" style={{ maxHeight: '300px' }}>
                  <table className="min-w-full">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-4 text-sm font-medium text-slate-500">Categoria</th>
                        <th className="text-right py-2 px-4 text-sm font-medium text-slate-500">Valor</th>
                        <th className="text-right py-2 px-4 text-sm font-medium text-slate-500">% do Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactionsLoading ? (
                        Array.from({ length: 5 }).map((_, index) => (
                          <tr key={index} className="border-b">
                            <td className="py-2 px-4"><Skeleton className="h-5 w-32" /></td>
                            <td className="py-2 px-4 text-right"><Skeleton className="h-5 w-20 ml-auto" /></td>
                            <td className="py-2 px-4 text-right"><Skeleton className="h-5 w-16 ml-auto" /></td>
                          </tr>
                        ))
                      ) : categoryDistributionByMonth.length > 0 ? (
                        <>
                          {categoryDistributionByMonth.map((category: any, index: number) => {
                            const total = categoryDistributionByMonth.reduce(
                              (sum: number, cat: any) => sum + cat.amount, 
                              0
                            );
                            const percentage = (category.amount / total) * 100;
                            
                            return (
                              <tr key={index} className="border-b hover:bg-slate-50">
                                <td className="py-2 px-4">
                                  <div className="flex items-center">
                                    <div 
                                      className="w-3 h-3 rounded-full mr-2" 
                                      style={{ backgroundColor: category.color }}
                                    />
                                    {category.category}
                                  </div>
                                </td>
                                <td className="py-2 px-4 text-right font-medium">
                                  {formatCurrency(category.amount)}
                                </td>
                                <td className="py-2 px-4 text-right">
                                  {percentage.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                          
                          <tr className="border-b bg-slate-50 font-medium">
                            <td className="py-2 px-4">Total</td>
                            <td className="py-2 px-4 text-right">
                              {formatCurrency(
                                categoryDistributionByMonth.reduce(
                                  (sum: number, cat: any) => sum + cat.amount, 
                                  0
                                )
                              )}
                            </td>
                            <td className="py-2 px-4 text-right">100%</td>
                          </tr>
                        </>
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-500">
                            Sem dados disponíveis
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </>
  );
}
