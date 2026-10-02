Beta: [BYOIP for IPv4 is a beta feature](https://cloud.ibm.com/docs/vpc?topic=vpc-release-notes#vpc-sep2926) that is available for evaluation and testing purposes to select customers. Access is restricted to allowlisted accounts.

## 

A public address range is a contiguous set of public IPs that you can reserve and bind to a VPC in an availability zone.

You can create public address ranges by using IBM-managed public IP address pools. You can also create public address ranges from custom authorized CIDRs, which allow you to use your own IP address ranges in the VPC. When you use a custom authorized CIDR, you define the public address range by selecting a CIDR block from your IP address range instead of specifying the number of IPs.

You can use ingress routing only with IPv4 public address ranges to route traffic to a target resource in the VPC, such as a virtual server instance, virtual network function (VNF), or other compute resource.

For example, you can configure public ingress routing to send the destination IP range to a VNF appliance next-hop. Response traffic from the target retains the original source IP as it exits the VPC, ensuring that return traffic isn't dropped. For more information about configuring ingress routing, see [About routing tables and routes](https://cloud.ibm.com/docs/vpc?topic=vpc-about-custom-routes&interface=api).

## Key capabilities and benefits

Public address ranges help support scalable, secure, and highly available network architectures.

Contiguous IP Range

A public address range provides a continuous set of public IPs for scalable and manageable routing and security policies.

Resource Management

Public address ranges can simplify access control and security while enabling a single public ingress route to inspect traffic from multiple endpoints and secure enterprise applications on the VPC.

Scalability

When additional public IP addresses are required, you can reserve a larger prefix instead of managing individual addresses.

High Availability

Public address ranges are regional resources that can be moved between VPCs and availability zones to support high availability and disaster recovery designs.

## Getting started

Before you begin, review [Planning considerations for public address ranges](https://cloud.ibm.com/docs/vpc?topic=vpc-par-planning).

### IPv4

Follow these steps to get started with IPv4 public address ranges.

1.  Ensure that you have [created a VPC](https://cloud.ibm.com/docs/vpc?topic=vpc-getting-started&interface=ui#create-and-configure-vpc) and all the needed resources (if not already present).
    
2.  Optionally, [create a custom authorized CIDR](https://cloud.ibm.com/docs/vpc?topic=vpc-provision-custom-authorized-cidr&interface=ui) to bring your own public IPv4 address range for use with public address ranges.
    
3.  [Create your public address range](https://cloud.ibm.com/docs/vpc?topic=vpc-par-creating&interface=ui).
    
4.  [Bind, unbind, and move public address ranges](https://cloud.ibm.com/docs/vpc?topic=vpc-par-unbinding-binding&interface=ui) after creating a public address range.
    
5.  [Configure an ingress routing table for your VPC](https://cloud.ibm.com/docs/vpc?topic=vpc-about-custom-routes&interface=ui) by adding routes that direct traffic to the next-hop IP of the target appliance, using the public IP address range as the destination. These routes direct public internet traffic to a next-hop within the VPC, such as a Network Functions Virtualization (NFV) instance, router, firewall, or load balancer.
    
    Note: The next-hop IP must be an IP address that is bound to a network interface on a subnet in the route's zone for ingress routing.
    

## Next steps

-   [Plan for public address ranges](https://cloud.ibm.com/docs/vpc?topic=vpc-par-planning).
-   [Review use cases for public address ranges](https://cloud.ibm.com/docs/vpc?topic=vpc-par-use-cases).
-   [Create a public address range](https://cloud.ibm.com/docs/vpc?topic=vpc-par-creating).
-   [Learn about custom authorized CIDRs](https://cloud.ibm.com/docs/vpc?topic=vpc-byoip).

## Reference and support

-   [IAM roles and actions](https://cloud.ibm.com/docs/iam?topic=iam-iam-service-roles-actions#is.public-address-range-roles)
-   [Quotas](https://cloud.ibm.com/docs/vpc?topic=vpc-quotas#par-quotas) and [service limits](https://cloud.ibm.com/docs/vpc?topic=vpc-quotas#service-limits-for-vpc-services)
-   [FAQ](https://cloud.ibm.com/docs/vpc?topic=vpc-faq-public-address-ranges)
-   [Known issues](https://cloud.ibm.com/docs/vpc?topic=vpc-par-known-issues)
-   [Troubleshooting](https://cloud.ibm.com/docs/vpc?group=tbs-par)