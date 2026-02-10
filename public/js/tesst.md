# MEMORANDUM

**TO:** Helpdesk Officer  
**FROM:** [Your Name/Department]  
**DATE:** February 9, 2026  
**SUBJECT:** Confirmation of System Changes - RSU PDF Report Field Mapping

---

Dear Helpdesk Officer,

This memorandum serves to formally confirm the approved changes to the Request for System Update (RSU) PDF Report generation process, specifically regarding the population of designated signature fields.

## APPROVED CHANGES:

Effective immediately, the following fields in the RSU PDF Report shall be automatically populated as follows:

### 1. Solution Provided By:
This field shall pull data from the **USR Assigned To** field
- If the assigned user exists in the system, their full name (First Name, Middle Name, Last Name) will be displayed
- If the assigned user does not exist in the system, the User ID will be displayed in the format: "User ID: [ID Number]"

### 2. Implemented By:
This field shall pull data from the **USR Assigned To** field
- Same logic as Solution Provided By applies

### 3. Verified By:
This field shall display the full name of the **Helpdesk Officer who created the USR**
- The system will retrieve this information from the USR creation record

### 4. Noted By:
This field shall automatically default to the appropriate manager based on the incident category:
- **Cat 1/1A/1B:** Wilfred Thomas B. Gorre
- **Cat 2/3:** Gervacio Alfredo N. Balatbat

## IMPLEMENTATION NOTES:

- All name fields will display in the format: First Name, Middle Name, Last Name
- The existing position and date fields will remain unchanged where applicable
- These changes apply to all RSU PDF reports generated moving forward

This change has been implemented to ensure consistency, accuracy, and proper accountability in the RSU documentation process.

Please acknowledge receipt and understanding of these changes by signing below.

---

**Acknowledged and Understood:**

_________________________________  
Helpdesk Officer Signature

_________________________________  
Printed Name

_________________________________  
Date

---

**Approved By:**

_________________________________  
[Your Name]  
[Your Position]

_________________________________  
Date