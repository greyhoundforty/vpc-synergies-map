## 

Create backup policies and plans for Block Storage for VPC volumes and File Storage for VPC shares to automate scheduled backups with tag-based targeting and retention rules.

## Before you begin

1.  Establish IAM user roles to grant [service-to-service authorizations](https://cloud.ibm.com/docs/vpc?topic=vpc-backup-s2s-auth#backup-s2s-auth-overview) so the backup service can detect tags on resources and create backups.
    
2.  Create user tags for new or existing resources (storage volumes, shares, or virtual server instances) that you can associate with a backup policy. For more information about adding tags, see [Apply tags to resources for backup policies](https://cloud.ibm.com/docs/vpc?topic=vpc-backup-use-policies). For more information about creating tags, see [Working with tags](https://cloud.ibm.com/docs/account?topic=account-tag).
    
3.  **Verify authorization scope:** Make sure that your service-to-service authorizations cover all resources that need backup. If you used resource-specific IAM policies, verify that every virtual server instance whose volumes need to be backed up is included in the authorization scope.
    
    Tip: To check your authorization scope, go to **Manage > Access (IAM) > Authorizations**. Review each authorization policy where the source is "IBM Cloud Backup for VPC" and the target is "Virtual Server for VPC". If you see specific resource attributes (for example, a single `instanceId`), broaden the scope or create more authorization policies to cover the required resources.
    

You're not required to create a backup plan when you create a backup policy, but it's good practice to create at least one backup plan with your policy.

Note: Backup jobs do not start until the scheduled time, and may start for up to 90 minutes after the scheduled time. For example, if you schedule a backup to run at 7:00 PM UTC, the backup job starts sometime between 7:00 PM and 8:30 PM UTC.

Deprecated: The Hyper Protect Crypto Services are deprecated. Customers can use existing instances until 20 March 2027. For more information, see [Deprecation of IBM Cloud Hyper Protect Crypto Services](https://cloud.ibm.com/docs/hs-crypto?topic=hs-crypto-faqs-deprecation-of-ibm-cloud-hyper-protect-crypto-services). For continued protection, consider migrating your existing encryption keys to a Dedicated Key Protect instance. For more information, see the [Migration guide](https://cloud.ibm.com/docs/key-protect?topic=key-protect-migrate-st).

## Creating a backup policy and plan in the console

You can use the UI to create a backup policy and plan.

### Creating a backup policy in the console

Use the following steps to create a backup policy by using the UI.

1.  In the [IBM Cloud console (opens in a new tab)](https://cloud.ibm.com/login), click the **Navigation menu** icon ![menu icon](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/icons/icon_hamburger.svg) **\> Infrastructure** ![VPC icon](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/icons/vpc.svg) **\> Storage > Backup policies**. The **Create** tab is selected by default.
    
    The UI displays a notification message when service-to-service authorizations are incorrect or missing on your account.
    
    Note: If your account doesn't allow for the required service-to-service authorizations and user access roles to create a backup policy, [contact IBM support](https://cloud.ibm.com/docs/vpc?topic=vpc-getting-help-and-support-for-vpc&interface=ui) for help.
    
2.  Enter information for each section of the provisioning form. Optionally create a backup plan for the policy.
    
    | 
    Field
    
     | 
    
    Description
    
     |
    | --- | --- |
    | **Location** | Select the location where you want to create the backup policy. |
    | 
    
    -   Geography
    
     | Select the appropriate value from the list of available geographies. |
    | 
    
    -   Region
    
     | Select the appropriate value from the list of available regions in the selected geography. |
    | **Details** | Enter details to define the policy. A policy defines what volumes are backed up. |
    | 
    
    -   Name
    
     | Provide a unique name for your backup policy that easily identifies the policy. Standard naming conventions apply to policies, plans, and backups. For example, see the [naming conventions for Snapshots](https://cloud.ibm.com/docs/vpc?topic=vpc-snapshots-vpc-planning#snapshots-vpc-naming). |
    | 
    
    -   Resource group
    
     | Optionally, specify a resource group for your policy. It can't be changed after you enter it.  
    For more information, see [best practices for organizing resources in a resource group](https://cloud.ibm.com/docs/account?topic=account-account_setup). |
    | 
    
    -   Resource tags
    
     | Optional tags to help you group and manage your backup policy. Consider writing tags as key:value pairs. For more information, see [Working with tags](https://cloud.ibm.com/docs/account?topic=account-tag&interface=ui). |
    | **Target resource type** | Choose between Individual block volumes, or multiple volumes that are attached to the same virtual server instance, or File shares.  
    When you choose to create a policy to back up volumes that are attached to the same virtual server instance you can choose to include the boot volume, too. |
    | **Tags for target resources** | Specify the user tags to apply to your target resources (volumes, virtual server instances, or shares) in your selected region. If multiple resources use the same tag, backups are created for all tagged resources. If a resource has multiple tags, it needs to match only one tag that is associated with the backup policy. After the backup policy is created, existing resources with any of the tags for target resources are automatically associated. |
    | **Scope** | This option is applicable only to Enterprise accounts. As an Enterprise account administrator, you can specify whether the backup policy applies to the Enterprise account alone or the Enterprise account and all of its subaccounts. Check the box to enable the policy for all accounts of the Enterprise. |
    | **Plan** | Click **Create** to create backup plan for this policy. In the side panel, specify the plan details. When finished, click **Create**. The page refreshes with a summary of the plan details. You can create up to four backup plans. All apply to the volumes with tags that match the backup policy.  
    For more information about options, see the next section. |
    
    Table 1. Backup policy provisioning selections
    
3.  Click **Create backup policy**. The order summary side panel shows the backup policy and all plans that were created for it.
    

Tip: If you're not ready to order yet or just looking for pricing information, you can add the information that you see in the side panel to an Estimate. For more information, see [Estimating your costs](https://cloud.ibm.com/docs/account?topic=account-cost).

### Creating a backup plan in the console

You can schedule backups in your plan on a daily, weekly, or monthly basis by using predefined settings, or by way of a `cron-spec` expression. The following steps describe the Create backup plan side panel.

1.  In the Create plane side panel, the plan status toggle is set to "enabled", by default.
    
2.  Enter a name for the plan (for example, _daily-dallas-vol1_). The plan name must be unique within the policy.
    
3.  Specify the **Frequency**. Select one of the following options from the list.
    
    -   Daily
        -   For a Daily plan, enter the **starting time (UTC)** in hours and minutes, Coordinated Universal Time. For example, 12 noon is 12:00. Local time conversion is automatically provided on the screen, for example, 12 PM Central Daylight Time.
    -   Weekly
        -   For a Weekly plan, select the days of the week that you want backups to run. For example, you can select Monday, Wednesday, and Friday. Specify the starting time in the same manner as a Daily plan.
    -   Monthly
        -   For a Monthly plan, select the day of the month that you want backups to run. For example, "1" schedules a backup every first of the month. Specify the starting time in the same manner as a Daily plan.
    -   Specify by using cron expression
        -   Under **Cron expression (UTC)**, enter the backup creation frequency in `cron-spec` format: minute, hour, day, month, and weekday. For example, to create a backup every day at 5:30 PM, you need to enter `30 17 * * *`.
    
    Note: The **Backup destination** shows the target resource's region. The **Backup resource group** is the resource group that is associated with the target resource.
    
4.  Specify a **Retention type** for the backups. You can specify how long to keep them by the number of days and the total number to retain.
    
    -   For **Age**, specify the number of days that you want to retain the backups in the range of 1 to 1000.
    -   For **Count**, provide the number of backups that you want to keep.
    
    To keep costs down, set a retention period or snapshots count adequate to your needs. For example, setting "7" for **Age** retains a week's worth of backups.
    
5.  Under **Optional**, you can configure two options for individual volume backups. When you're creating a plan for a policy that is for multi-volume backups or share backups, fast snapshot restore is not available.
    
    -   **Fast snapshot restore** - When you enable this feature, you must specify the zone or zones where you want [fast restore](https://cloud.ibm.com/docs/vpc?topic=vpc-snapshots-vpc-about#snapshots_vpc_fast_restore) enabled. You can also specify the maximum number of fast restore snapshots that you want to retain.
        
        The fast restore feature is billed at an extra hourly rate for each zone that it is enabled in regardless of the size of the snapshot. Maintaining fast restore clones is considerably more costly than keeping regular snapshots. Because backup plans automatically create and retain multiple snapshots based on your backup schedule and retention policy, each retained snapshot maintains its own set of active clones in each zone.
        
    -   **Tagging**, specify more tags that apply to the backup when the plan runs.
        
        -   Select the box to copy all tags from the source resource to all backups.
        -   Under **Tags for backups**, you can manually add any extra plan tags in this field. This option is not available for File share backups.
6.  If you're creating a backup plan for multi-volume backups or share backups, you can click **Create** and return to the backup policy page. If you're creating a backup plan for individual volumes, you can click **Next** to proceed to configure remote copies, which are an optional part of the plan.
    
    1.  To create cross-regional copies of your backup, select the geography and regions where you want to have a copy. Remember, you can have only one copy per region.
    2.  Click the toggle to enable remote copy in the selected region.
    3.  If the source snapshot is encrypted by using a customer-managed key, you must select the encryption service instance and provide the key name. If you prefer, you can create a service instance or encryption key by following the links.
        -   Key Protect - it can be used when the original volume is encrypted by using the Key Protect service.
    4.  Click **Apply changes** to save the new plan. The list of plans is updated in the policy details page.
7.  If you want to make any changes, click the **Edit icon** ![Edit icon](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/icons/edit-tagging.svg "Edit") for that plan. If you want to delete the plan, click the delete icon.
    

### Estimating your expected usage and costs

Use the cost estimator to see what your backups might cost based on the rate of expected change in your Block Storage for VPC volumes.

Note: The cost estimator only calculates standard backup storage capacity charges. It does not include flat hourly rate charges for active Fast Restore clones or cross-regional remote copies.

1.  After you create your backup policy and plan, on the side panel of the Backup summary, click **Add to estimate**.
    
2.  On the Estimate side panel, enter your expected usage to the initial costs. The backup policy is without charge. You pay for the amount of backup storage that is used. Provide the following estimates:
    
    -   Number of volumes or shares that you want to associate with the backup policy.
    -   Average amount of data per volume or share (in GBs). For example, you might associate two volumes with a policy. The first volume has 4 GB of data and the second 20 GB. An average of the two would be 12 GB.
    -   Number of backups per volume or share per month. You can take a maximum of 750 backup snapshots per volume and a maximum of 750 backups per share.
    -   Percentage of incremental change after the initial backup. For example, a 15% increase in size for each subsequent backup.
3.  When you're finished, click **Calculate cost**.
    

The cost estimate summary shows how the costs are calculated and breaks down the storage costs, providing a monthly estimate. Click **Save** to see the details on the cost estimator panel.

## Next steps

After you create a backup policy, you can do the following actions.

-   [Apply tags to your resources for backups](https://cloud.ibm.com/docs/vpc?topic=vpc-backup-use-policies).
-   [View a list of backup policies](https://cloud.ibm.com/docs/vpc?topic=vpc-backup-view-policies) that you created.
-   [Manage your backup policies and plans](https://cloud.ibm.com/docs/vpc?topic=vpc-backup-service-manage).