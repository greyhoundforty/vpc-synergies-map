## 

Plan your File Storage for VPC snapshot strategy by considering interface options, naming conventions, retention policies, and restoration requirements.

## Planning to create and use snapshots

Consider the following topics and prerequisites before you create snapshots.

| 
Item

 | 

Considerations

 |
| --- | --- |
| 

-   **Interface**

 | Choose between the console, CLI, API, or Terraform to create and manage your snapshots. |
| 

-   **Share**

 | 

-   Evaluate which shares are most important to snapshot.
-   Evaluate the amount of change that you expect in the data that you intend to snapshot. A share with numerous changes and a lengthy retention period requires more attention than a share with moderate changes. Also, the cumulative size of all snapshots for a share can't exceed 100 TB.

 |
| 

-   **Naming conventions**

 | Select a unique name for your snapshot. It's easier to filter and search for them later. For more information, see [Naming snapshots](https://cloud.ibm.com/docs/vpc?topic=vpc-fs-snapshots-planning#fs-snapshots-naming). |
| 

-   **Snapshots retention**

 | Evaluate how many snapshots to retain, how long you need to retain them, and when to delete snapshots. Review the [snapshots limitations](https://cloud.ibm.com/docs/vpc?topic=vpc-fs-snapshots-about#fs-snapshots-limitations) before you perform these actions. |
| 

-   **Restoring a share**

 | Consider when you might want to create a share from a snapshot. If you need to revert to an earlier version of the share, plan which snapshot you want to use to create the share. |
| 

-   **Billing**

 | Think about the number of snapshots that you want to keep. You're charged for the storage that is used. |

Table 1. Checklist for planning snapshots of shares

## Naming snapshots

Share snapshot names must be unique at the share level. Snapshot names adhere to the same requirements as share names. Valid names can include a combination of lowercase alpha-numeric characters (a-z, 0-9) and the hyphen (-), up to 63 characters. Snapshot names must begin with a lowercase letter and must be unique across the VPC. The UI provides name checking as a convenience. For example, if you end a snapshot name with a hyphen (-), the console notifies you of the error.

## Next Steps

After you planned your snapshots, you can [create snapshots](https://cloud.ibm.com/docs/vpc?topic=vpc-fs-snapshots-create#fs-snapshots-create) of your shares.