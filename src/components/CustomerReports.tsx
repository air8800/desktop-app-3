import React, { useState } from 'react';
import { Users, TrendingUp, CheckCircle, Download, RefreshCw, Calendar, IndianRupee, UserPlus, UserCheck, Target, Award, BarChart3, PieChart, ArrowUp, ArrowDown, Filter, Search, Eye, MoreVertical } from 'lucide-react';

const CustomerReports: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [reportType, setReportType] = useState<'overview' | 'detailed' | 'growth'>('overview');

  // Customer Reports Data
  const customerData = {
    totalCustomers: 156,
    repeatCustomers: 89,
    newThisWeek: 12,
    newThisMonth: 45,
    customerGrowth: '+15%',
    retentionRate: '68%',
    averageLifetimeValue: 2340,
    averageOrderValue: 45,
    topCustomers: [
      { id: 1, name: 'Rahul Sharma', orders: 24, revenue: 1250, lastOrder: '2 days ago', status: 'VIP' },
      { id: 2, name: 'Priya Singh', orders: 18, revenue: 980, lastOrder: '1 day ago', status: 'Regular' },
      { id: 3, name: 'Vikram Patel', orders: 15, revenue: 750, lastOrder: '3 days ago', status: 'Regular' },
      { id: 4, name: 'Anjali Desai', orders: 12, revenue: 650, lastOrder: '1 week ago', status: 'Regular' },
      { id: 5, name: 'Rajesh Kumar', orders: 10, revenue: 580, lastOrder: '4 days ago', status: 'New' }
    ],
    customerSegments: [
      { segment: 'VIP Customers', count: 15, percentage: 9.6, revenue: 8500 },
      { segment: 'Regular Customers', count: 89, percentage: 57.1, revenue: 15200 },
      { segment: 'New Customers', count: 45, percentage: 28.8, revenue: 4800 },
      { segment: 'Inactive Customers', count: 7, percentage: 4.5, revenue: 0 }
    ],
    monthlyGrowth: [
      { month: 'Jan', newCustomers: 12, totalRevenue: 5200 },
      { month: 'Feb', newCustomers: 18, totalRevenue: 6800 },
      { month: 'Mar', newCustomers: 25, totalRevenue: 8900 },
      { month: 'Apr', newCustomers: 32, totalRevenue: 11200 },
      { month: 'May', newCustomers: 28, totalRevenue: 9800 },
      { month: 'Jun', newCustomers: 45, totalRevenue: 14500 }
    ]
  };

  // Download Customer Report
  const downloadCustomerReport = (type: 'summary' | 'detailed' | 'growth') => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      reportType: `Customer ${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
      period: timeRange === '7d' ? 'Last 7 Days' : timeRange === '30d' ? 'Last 30 Days' : timeRange === '90d' ? 'Last 90 Days' : 'Last Year',
      summary: customerData,
      detailedMetrics: {
        acquisitionRate: '12 new customers/week',
        churnRate: '5%',
        lifetimeValue: `₹${customerData.averageLifetimeValue}`,
        averageOrderFrequency: '2.3 orders/month',
        customerSatisfaction: '4.7/5',
        referralRate: '18%'
      },
      insights: [
        'Customer acquisition is growing steadily at 15% month-over-month',
        'VIP customers contribute 30% of total revenue despite being only 9.6% of customer base',
        'Customer retention rate of 68% is above industry average',
        'Average order value has increased by 12% in the last quarter'
      ],
      recommendations: [
        'Implement loyalty program to increase retention rate',
        'Focus on converting regular customers to VIP status',
        'Develop re-engagement campaigns for inactive customers',
        'Expand referral program to leverage high satisfaction scores'
      ]
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customer-${type}-report-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="card-full-height p-8 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-200 dark:border-green-800 shadow-large">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6">
          <div className="flex items-center">
            <div className="w-16 h-16 bg-gradient-success rounded-2xl flex items-center justify-center shadow-large mr-6">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-green-800 dark:text-green-300">Customer Reports</h2>
              <p className="text-green-600 dark:text-green-400 text-lg">Comprehensive customer analytics and insights</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="input cursor-pointer border-green-300 dark:border-green-600 focus:ring-green-500"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
            </select>
            
            <button
              onClick={() => downloadCustomerReport('summary')}
              className="btn-success shadow-large hover:shadow-xl"
            >
              <Download className="h-5 w-5 mr-2" />
              Download Report
            </button>
          </div>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setReportType('overview')}
          className={`card-full-height p-6 text-left transition-all duration-300 border-2 ${
            reportType === 'overview'
              ? 'border-green-500 dark:border-green-400 shadow-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30'
              : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-large'
          }`}
        >
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 bg-gradient-success rounded-lg flex items-center justify-center shadow-soft mr-3">
              <Users className="h-5 w-5 text-white" />
            </div>
            <h3 className={`font-bold text-lg ${reportType === 'overview' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
              Overview
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Key metrics and customer segments</p>
        </button>

        <button
          onClick={() => setReportType('detailed')}
          className={`card-full-height p-6 text-left transition-all duration-300 border-2 ${
            reportType === 'detailed'
              ? 'border-blue-500 dark:border-blue-400 shadow-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30'
              : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-large'
          }`}
        >
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center shadow-soft mr-3">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <h3 className={`font-bold text-lg ${reportType === 'detailed' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
              Detailed Analysis
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">In-depth customer behavior analysis</p>
        </button>

        <button
          onClick={() => setReportType('growth')}
          className={`card-full-height p-6 text-left transition-all duration-300 border-2 ${
            reportType === 'growth'
              ? 'border-purple-500 dark:border-purple-400 shadow-xl bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30'
              : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-large'
          }`}
        >
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 bg-gradient-warning rounded-lg flex items-center justify-center shadow-soft mr-3">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <h3 className={`font-bold text-lg ${reportType === 'growth' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-900 dark:text-white'}`}>
              Growth Trends
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Growth patterns and forecasting</p>
        </button>
      </div>

      {/* Report Content */}
      {reportType === 'overview' && (
        <div className="space-y-8">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card-full-height p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-soft">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div className="flex items-center text-blue-600 dark:text-blue-400">
                  <ArrowUp className="h-4 w-4 mr-1" />
                  <span className="text-sm font-medium">{customerData.customerGrowth}</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">{customerData.totalCustomers}</div>
              <div className="text-sm font-semibold text-blue-800 dark:text-blue-300">Total Customers</div>
            </div>

            <div className="card-full-height p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-soft">
                  <UserCheck className="h-6 w-6 text-white" />
                </div>
                <div className="flex items-center text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  <span className="text-sm font-medium">{customerData.retentionRate}</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">{customerData.repeatCustomers}</div>
              <div className="text-sm font-semibold text-green-800 dark:text-green-300">Repeat Customers</div>
            </div>

            <div className="card-full-height p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center shadow-soft">
                  <UserPlus className="h-6 w-6 text-white" />
                </div>
                <div className="flex items-center text-purple-600 dark:text-purple-400">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  <span className="text-sm font-medium">+{customerData.newThisMonth}</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">{customerData.newThisWeek}</div>
              <div className="text-sm font-semibold text-purple-800 dark:text-purple-300">New This Week</div>
            </div>

            <div className="card-full-height p-6 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/30 dark:to-yellow-900/30 border-orange-200 dark:border-orange-800">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-soft">
                  <IndianRupee className="h-6 w-6 text-white" />
                </div>
                <div className="flex items-center text-orange-600 dark:text-orange-400">
                  <Award className="h-4 w-4 mr-1" />
                  <span className="text-sm font-medium">LTV</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">₹{customerData.averageLifetimeValue}</div>
              <div className="text-sm font-semibold text-orange-800 dark:text-orange-300">Avg Lifetime Value</div>
            </div>
          </div>

          {/* Customer Segments */}
          <div className="card-full-height p-8 shadow-large">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                <PieChart className="h-6 w-6 mr-2" />
                Customer Segments
              </h3>
              <button
                onClick={() => downloadCustomerReport('detailed')}
                className="btn-secondary p-3 hover:scale-110 transition-transform"
              >
                <Download className="h-5 w-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                {customerData.customerSegments.map((segment, index) => (
                  <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{segment.segment}</h4>
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">₹{segment.revenue}</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{segment.count} customers</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{segment.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${segment.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="space-y-4">
                <h4 className="font-bold text-gray-900 dark:text-white mb-4">Segment Insights</h4>
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">VIP customers generate 30% of total revenue</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-xl border border-green-200 dark:border-green-800">
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">Regular customers show highest retention rate</p>
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-xl border border-purple-200 dark:border-purple-800">
                    <p className="text-sm font-medium text-purple-800 dark:text-purple-300">New customer acquisition is accelerating</p>
                  </div>
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/30 rounded-xl border border-orange-200 dark:border-orange-800">
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Inactive customers need re-engagement</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'detailed' && (
        <div className="space-y-8">
          {/* Top Customers */}
          <div className="card-full-height p-8 shadow-large">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                <Award className="h-6 w-6 mr-2" />
                Top Customers
              </h3>
              <div className="flex gap-3">
                <button className="btn-secondary p-3">
                  <Search className="h-5 w-5" />
                </button>
                <button className="btn-secondary p-3">
                  <Filter className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Orders</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Revenue</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Last Order</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customerData.topCustomers.map((customer, index) => (
                    <tr key={customer.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-white font-bold mr-3">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{customer.name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Customer #{customer.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-semibold text-gray-900 dark:text-white">{customer.orders}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-green-600 dark:text-green-400">₹{customer.revenue}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-gray-600 dark:text-gray-400">{customer.lastOrder}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          customer.status === 'VIP' 
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                            : customer.status === 'Regular'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        }`}>
                          {customer.status}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <button className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {reportType === 'growth' && (
        <div className="space-y-8">
          {/* Monthly Growth Chart */}
          <div className="card-full-height p-8 shadow-large">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                <TrendingUp className="h-6 w-6 mr-2" />
                Monthly Growth Trends
              </h3>
              <button
                onClick={() => downloadCustomerReport('growth')}
                className="btn-primary"
              >
                <Download className="h-5 w-5 mr-2" />
                Download Growth Report
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-4">New Customer Acquisition</h4>
                <div className="space-y-3">
                  {customerData.monthlyGrowth.map((month, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <span className="font-medium text-gray-900 dark:text-white">{month.month}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">{month.newCustomers} customers</span>
                        <span className="text-green-600 dark:text-green-400 font-semibold">₹{month.totalRevenue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-4">Growth Insights</h4>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-xl border border-green-200 dark:border-green-800">
                    <div className="flex items-center mb-2">
                      <ArrowUp className="h-5 w-5 text-green-600 mr-2" />
                      <span className="font-semibold text-green-800 dark:text-green-300">Customer Growth Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">+15%</p>
                    <p className="text-sm text-green-700 dark:text-green-400">Month over month</p>
                  </div>
                  
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center mb-2">
                      <Target className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="font-semibold text-blue-800 dark:text-blue-300">Revenue per Customer</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">₹{customerData.averageOrderValue}</p>
                    <p className="text-sm text-blue-700 dark:text-blue-400">Average order value</p>
                  </div>
                  
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center mb-2">
                      <CheckCircle className="h-5 w-5 text-purple-600 mr-2" />
                      <span className="font-semibold text-purple-800 dark:text-purple-300">Retention Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{customerData.retentionRate}</p>
                    <p className="text-sm text-purple-700 dark:text-purple-400">Above industry average</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => downloadCustomerReport('summary')}
          className="btn-success shadow-large hover:shadow-xl"
        >
          <Download className="h-5 w-5 mr-2" />
          Download Summary Report
        </button>
        <button
          onClick={() => downloadCustomerReport('detailed')}
          className="btn-primary shadow-large hover:shadow-xl"
        >
          <BarChart3 className="h-5 w-5 mr-2" />
          Download Detailed Analysis
        </button>
        <button
          onClick={() => downloadCustomerReport('growth')}
          className="btn-secondary shadow-large hover:shadow-xl"
        >
          <TrendingUp className="h-5 w-5 mr-2" />
          Download Growth Report
        </button>
      </div>
    </div>
  );
};

export default CustomerReports;