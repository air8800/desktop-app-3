import React, { useState, useEffect } from 'react';
import { PrintJob } from '../types';
import { Files, Printer, IndianRupee, Clock, X, TrendingUp, Calendar } from 'lucide-react';

interface StatsCardsProps {
  jobs: PrintJob[];
}

interface StatDetails {
  today: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
}

interface RevenueDetails {
  today: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
}

const StatsCards: React.FC<StatsCardsProps> = ({ jobs }) => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [historicalData, setHistoricalData] = useState<{
    totalJobs: StatDetails;
    pendingJobs: StatDetails;
    completedJobs: StatDetails;
    revenue: RevenueDetails;
  } | null>(null);

  // Get date ranges
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // Calculate statistics
  const calculateStats = () => {
    // Today's jobs
    const todaysJobs = jobs.filter(job => {
      const jobDate = new Date(job.created_at);
      return jobDate >= today;
    });

    // This week's jobs
    const thisWeekJobs = jobs.filter(job => {
      const jobDate = new Date(job.created_at);
      return jobDate >= weekAgo;
    });

    // This month's jobs
    const thisMonthJobs = jobs.filter(job => {
      const jobDate = new Date(job.created_at);
      return jobDate >= monthStart;
    });

    // This year's jobs
    const thisYearJobs = jobs.filter(job => {
      const jobDate = new Date(job.created_at);
      return jobDate >= yearStart;
    });

    // Total jobs stats
    const totalJobsStats: StatDetails = {
      today: todaysJobs.length,
      thisWeek: thisWeekJobs.length,
      thisMonth: thisMonthJobs.length,
      thisYear: thisYearJobs.length
    };

    // Pending jobs stats
    const pendingJobsStats: StatDetails = {
      today: todaysJobs.filter(j => j.job_status === 'pending').length,
      thisWeek: thisWeekJobs.filter(j => j.job_status === 'pending').length,
      thisMonth: thisMonthJobs.filter(j => j.job_status === 'pending').length,
      thisYear: thisYearJobs.filter(j => j.job_status === 'pending').length
    };

    // Completed jobs stats
    const completedJobsStats: StatDetails = {
      today: todaysJobs.filter(j => j.job_status === 'completed').length,
      thisWeek: thisWeekJobs.filter(j => j.job_status === 'completed').length,
      thisMonth: thisMonthJobs.filter(j => j.job_status === 'completed').length,
      thisYear: thisYearJobs.filter(j => j.job_status === 'completed').length
    };

    // Revenue stats (only from paid and completed jobs)
    const calculateRevenue = (jobsList: PrintJob[]) => {
      return jobsList.reduce((sum, job) => {
        if (job.payment_status === 'paid' && job.job_status === 'completed') {
          return sum + (job.total_cost || 0);
        }
        return sum;
      }, 0);
    };

    const revenueStats: RevenueDetails = {
      today: calculateRevenue(todaysJobs),
      thisWeek: calculateRevenue(thisWeekJobs),
      thisMonth: calculateRevenue(thisMonthJobs),
      thisYear: calculateRevenue(thisYearJobs)
    };

    return {
      totalJobs: totalJobsStats,
      pendingJobs: pendingJobsStats,
      completedJobs: completedJobsStats,
      revenue: revenueStats
    };
  };

  // Load and save historical data
  useEffect(() => {
    // Calculate current stats
    const currentStats = calculateStats();

    // Save to localStorage
    localStorage.setItem('stats-historical-data', JSON.stringify(currentStats));

    setHistoricalData(currentStats);
  }, [jobs]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('stats-historical-data');
    if (saved) {
      try {
        setHistoricalData(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse historical data');
      }
    }
  }, []);

  if (!historicalData) {
    return <div className="text-gray-500 dark:text-gray-400">Loading statistics...</div>;
  }

  const stats = [
    {
      id: 'total',
      title: 'Total Jobs',
      value: historicalData.totalJobs.today.toString(),
      subtitle: "Today's orders",
      icon: Files,
      details: historicalData.totalJobs
    },
    {
      id: 'pending',
      title: 'Pending Jobs',
      value: historicalData.pendingJobs.thisYear.toString(),
      subtitle: 'All pending orders',
      icon: Clock,
      details: historicalData.pendingJobs
    },
    {
      id: 'completed',
      title: 'Completed Jobs',
      value: historicalData.completedJobs.thisYear.toString(),
      subtitle: 'All completed orders',
      icon: Printer,
      details: historicalData.completedJobs
    },
    {
      id: 'revenue',
      title: 'Revenue Today',
      value: `₹${historicalData.revenue.today.toLocaleString()}`,
      subtitle: `${historicalData.totalJobs.today} orders today`,
      icon: IndianRupee,
      details: historicalData.revenue
    }
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.id}
              onClick={() => setExpandedCard(stat.id)}
              className="bg-blue-50 dark:bg-gray-800/80 border-2 border-blue-200 dark:border-gray-600/50 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-scale-in cursor-pointer hover:scale-105"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-blue-500 dark:bg-gradient-primary rounded-lg p-3 shadow-md">
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-blue-700 dark:text-gray-300">
                  {stat.title}
                </h3>
                <p className="text-3xl font-bold text-blue-900 dark:text-white">
                  {stat.value}
                </p>
                <p className="text-xs text-blue-700 dark:text-gray-400 opacity-75">
                  {stat.subtitle}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-blue-200 dark:border-gray-700/50">
                <div className="flex items-center justify-between text-xs text-blue-700 dark:text-gray-400">
                  <div className="flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    <span>Click for details</span>
                  </div>
                  <TrendingUp className="h-3 w-3" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Card Modal */}
      {expandedCard && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full animate-scale-in overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {(() => {
                    const stat = stats.find(s => s.id === expandedCard);
                    if (!stat) return null;
                    const Icon = stat.icon;
                    return (
                      <>
                        <div className="bg-white/20 rounded-lg p-3 mr-4">
                          <Icon className="h-8 w-8" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold">{stat.title}</h2>
                          <p className="text-blue-100 text-sm">Detailed Statistics</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <button
                  onClick={() => setExpandedCard(null)}
                  className="bg-white/20 hover:bg-white/30 rounded-lg p-2 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {(() => {
                const stat = stats.find(s => s.id === expandedCard);
                if (!stat) return null;

                const isRevenue = stat.id === 'revenue';
                const periods = [
                  { label: 'Today', value: stat.details.today, icon: '📅' },
                  { label: 'This Week', value: stat.details.thisWeek, icon: '📊' },
                  { label: 'This Month', value: stat.details.thisMonth, icon: '📈' },
                  { label: 'This Year', value: stat.details.thisYear, icon: '🎯' }
                ];

                return (
                  <div className="space-y-4">
                    {periods.map((period, idx) => (
                      <div
                        key={period.label}
                        className="bg-blue-50 dark:bg-gray-700/50 border-2 border-blue-200 dark:border-gray-600/50 rounded-xl p-5 hover:shadow-md transition-all duration-200"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span className="text-2xl mr-3">{period.icon}</span>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {period.label}
                              </h3>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {period.label === 'Today' && 'Last 24 hours'}
                                {period.label === 'This Week' && 'Last 7 days'}
                                {period.label === 'This Month' && 'Current month'}
                                {period.label === 'This Year' && 'Current year'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-blue-600 dark:text-white">
                              {isRevenue ? `₹${period.value.toLocaleString()}` : period.value}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {isRevenue ? 'Revenue' : 'Jobs'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Summary Footer */}
                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                        <span>📊 Data stored locally</span>
                        <span>🔄 Auto-updated</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StatsCards;
