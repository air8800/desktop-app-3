//////////////////// 2Printer ReadMe file ////////////////////

1. The Introduction

2Printer is a command line tool designed for batch printing of documents and image files. It offers the ability to automate the printing process for various file types including image files, text files, drawings, worksheets, presentations, and PDF documents.

When it comes to printing PDF documents and image files like JPEG, TIFF, PNG, PCX, DCX, Bitmap, and TGA, 2Printer utilizes its internal graphic engine, with no need for additional software.

For printing text documents and drawings, 2Printer relies on third-party software through public APIs. Therefore, to print files in formats such as TXT, RTF, DOC, DOCX, VSD, DWG, DXF, XLS, XLSX, PPT, or PPTX, you will need to have Microsoft Word, Microsoft Visio, Autodesk AutoCAD, Microsoft Excel, or Microsoft PowerPoint installed and activated, respectively.

By default, 2Printer uses the current settings of the selected printer for printing documents and image files. To change these settings, follow these steps:

1. In Windows, open Control Panel > "View devices and printers".
2. Right-click on the desired printer and select "Printing preferences".
3. Adjust the settings as needed and click "OK".
These new settings will be used by 2Printer when printing to the selected printer.

2Printer is compatible with all printers directly connected to your computer, including virtual printers and printers connected via a local network.

In addition to printing, 2Printer can also be used to automate the conversion of documents to PDF or image files such as JPEG, TIFF, and PNG. Instead of using your physical printer, you can utilize a virtual printer like Universal Document Converter.

Thanks to its command line interface, you can create your own batch (BAT) files for automating the printing of specific documents. You can also create CMD files and add them to the Task Scheduler to print all documents within a selected folder.

The trial version of 2Printer is available free for testing and evaluation. For business purposes, please purchase the commercial version of 2Printer. Visit the official website at https://www.cmd2printer.com for more information.


2. 2Printer command line syntax and examples

1) Read the 2Printer help file:
2Printer -help

2) Print all documents from the folder "C:\Input" on the system default printer:
2Printer -src "C:\Input\*.*"

3) Print all documents from the list file "C:\ToDo\input.txt" on the system default printer. The "input.txt" should be a Unicode or ASCII text file with a list of paths to 
document files. Each new file path in this file should be on a separate line. 
2Printer -src "@C:\ToDo\input.txt"

4) Print all documents from the folder "C:\Input" with all subfolders on the system default printer:
2Printer -src "C:\Input\*.*" -options scansf:yes

5) Get a full list of available printers:
2Printer -options showprnlist

6) Print all documents from "C:\Input" on the printer "Canon MP610 series Printer":
2Printer -src "C:\Input\*.*" -prn "Canon MP610 series Printer"

7) Print all documents from "C:\Input" on the virtual printer "Universal Document Converter":
2Printer -src "C:\Input\*.*" -prn "Universal Document Converter"

8) Print documents in silent mode:
2Printer -src "C:\Input\*.*" -options silent:yes

9) Edit the ini-file with 2Printer default settings:
2Printer -ini