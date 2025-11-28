import { PrintJob, Printer } from '../types';

// Generate random timestamp within the last 3 days
const getRandomTimestamp = () => {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
  const randomTime = threeDaysAgo.getTime() + Math.random() * (now.getTime() - threeDaysAgo.getTime());
  return new Date(randomTime).toISOString();
};

// Mock print jobs
export const mockJobs: PrintJob[] = [
  {
    id: '1',
    filename: 'business_proposal.pdf',
    copies: 3,
    printType: 'Double',
    colorMode: 'Color',
    paperSize: 'A4',
    paymentStatus: 'Paid',
    customerName: 'Rahul Sharma',
    customerEmail: 'rahul.sharma@example.com',
    timestamp: getRandomTimestamp(),
    status: 'Pending'
  },
  {
    id: '2',
    filename: 'wedding_invitation.pdf',
    copies: 50,
    printType: 'Single',
    colorMode: 'Color',
    paperSize: 'A5',
    paymentStatus: 'Paid',
    customerName: 'Priya Singh',
    customerEmail: 'priya.singh@example.com',
    timestamp: getRandomTimestamp(),
    status: 'Printed'
  },
  {
    id: '3',
    filename: 'resume_final.docx',
    copies: 10,
    printType: 'Single',
    colorMode: 'BW',
    paperSize: 'A4',
    paymentStatus: 'Unpaid',
    customerName: 'Vikram Patel',
    customerEmail: 'vikram.patel@example.com',
    timestamp: getRandomTimestamp(),
    status: 'Pending'
  },
  {
    id: '4',
    filename: 'project_report.pdf',
    copies: 2,
    printType: 'Double',
    colorMode: 'BW',
    paperSize: 'A4',
    paymentStatus: 'Unpaid',
    customerName: 'Anjali Desai',
    customerEmail: 'anjali.desai@example.com',
    timestamp: getRandomTimestamp(),
    status: 'Pending'
  },
  {
    id: '5',
    filename: 'marketing_brochure.pdf',
    copies: 100,
    printType: 'Double',
    colorMode: 'Color',
    paperSize: 'A4',
    paymentStatus: 'Paid',
    customerName: 'Rajesh Kumar',
    customerEmail: 'rajesh.kumar@example.com',
    timestamp: getRandomTimestamp(),
    status: 'Printed'
  },
  {
    id: '6',
    filename: 'lecture_notes.pdf',
    copies: 5,
    printType: 'Single',
    colorMode: 'BW',
    paperSize: 'A4',
    paymentStatus: 'Paid',
    customerName: 'Meera Joshi',
    customerEmail: 'meera.joshi@example.com',
    timestamp: getRandomTimestamp(),
    status: 'Cancelled'
  },
  {
    id: '7',
    filename: 'conference_schedule.docx',
    copies: 25,
    printType: 'Single',
    colorMode: 'Color',
    paperSize: 'A4',
    paymentStatus: 'Paid',
    customerName: 'Arjun Reddy',
    customerEmail: 'arjun.reddy@example.com',
    timestamp: getRandomTimestamp(),
    status: 'Pending'
  },
  {
    id: '8',
    filename: 'legal_documents.pdf',
    copies: 3,
    printType: 'Double',
    colorMode: 'BW',
    paperSize: 'Legal',
    paymentStatus: 'Unpaid',
    customerName: 'Kiran Nair',
    customerEmail: 'kiran.nair@example.com',
    timestamp: getRandomTimestamp(),
    status: 'Pending'
  }
];

// Mock printers
export const mockPrinters: Printer[] = [
  {
    name: 'HP LaserJet Pro',
    status: 'Ready',
    default: true
  },
  {
    name: 'Canon PIXMA',
    status: 'Ready',
    default: false
  },
  {
    name: 'Epson WorkForce',
    status: 'Low Ink',
    default: false
  }
];