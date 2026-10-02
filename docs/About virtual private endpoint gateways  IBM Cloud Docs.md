## 

IBM Cloud® Virtual Private Endpoints (VPE) for VPC enables you to connect to supported IBM Cloud services from your VPC network by using the IP addresses of your choosing, allocated from a subnet within your VPC.

VPE is an evolution of the private connectivity to IBM Cloud services. VPEs are virtual IP interfaces that are bound to an endpoint gateway created on a per service, or service instance, basis (depending on the service operation model). The endpoint gateway is a virtualized function that scales horizontally, is redundant and highly available, and spans all availability zones of your VPC. Endpoint gateways enable communications from virtual server instances within your VPC and IBM Cloud® service on the private backbone. VPE for VPC gives you the experience of controlling all the private addressing within your cloud.

Important: Similar to service endpoints, VPE for VPC provides private connectivity to IBM services, but within the VPC network of your choosing.

## Overview of features

The features of VPE for VPC include:

-   Public connectivity is not required and has no public data egress charges.
    
-   Reaches IBM Cloud assets through a private service provider.
    
-   A VPE lives in your network address space, extending your private and multicloud into the IBM Cloud.
    
-   You can apply security through Network Access Control Lists (NACLs).
    
-   The endpoint IP deploys in a customer-defined, virtual network.
    
-   Includes platform integration to VPC - Identity and Access Management (IAM), network ACLs, security groups, and tagging.
    
-   Access to new endpoints is achieved through the console, CLI, and API.
    
-   Local-access VPE gateway for supported IBM Cloud services within a DNS-sharing VPC topology. This allows local, private connectivity between a shared-VPC VPE gateway and the cloud service, eliminating the need to route traffic through the hub VPC. Currently supported only for IBM Cloud Object Storage.
    
-   Integrates with DNS Services.
    
-   Access to new endpoints is achieved through the console, CLI, and API.
    
-   Integrates with DNS Services.
    
-   Connect services and resources across different IBM Cloud accounts while keeping traffic on the IBM Cloud private network.
    
    Note: When creating an endpoint gateway, a DNS zone and records are created. The VPE service automatically upgrades your virtual server instances to use the private DNS as the default DNS resolver. For more information, see [DNS Services](https://cloud.ibm.com/docs/dns-svcs?topic=dns-svcs-getting-started).
    

## Supported services

For supported IBM Cloud services, see [VPE supported services](https://cloud.ibm.com/docs/vpc?topic=vpc-vpe-supported-services).

## Getting started

To configure a virtual private endpoint, follow these steps:

1.  List the available services, including IBM Cloud infrastructure services available (by default) for all VPC users.
2.  Review planning considerations. See [Planning for virtual private endpoint gateways](https://cloud.ibm.com/docs/vpc?topic=vpc-vpe-planning-considerations) for details.
3.  Create an endpoint gateway for each service that you want to be privately available to the VPC. See [Creating an endpoint gateway](https://cloud.ibm.com/docs/vpc?topic=vpc-ordering-endpoint-gateway) for details.
4.  Bind a reserved IP address to the endpoint gateway. See [Binding and unbinding a reserved IP address](https://cloud.ibm.com/docs/vpc?topic=vpc-bind-unbind-reserved-ip) for details.

After you create the endpoint gateway, virtual server instances in the VPC can access the IBM Cloud service privately through it.

## VPE connectivity patterns

VPE for VPC IP addresses use a multi-zone-region, logical endpoint gateway to connect to a service endpoint on the IBM Cloud private backbone. The endpoint gateway is designed to support the best practice of binding a single IP from each zone of the VPC. You can create an endpoint gateway with zero IP addresses and bind IPs as each zone is brought online.

As more IBM Cloud services are enabled for VPE for VPC, each service instance will require you to configure its endpoint gateway, but will leverage the same topologies and best practices. For additional provisioning and best practices guidelines, refer to the documentation provided by the individual service.

### Single-zone topology

![VPE single-zone topology](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/vpc/images/vpe-single-zone.png)

Figure 1. VPE single-zone topology

### Multi-zone topology

![VPE multi-zone topology](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/vpc/images/vpe-multi-zone.png)

Figure 2. VPE multi-zone topology

## Connecting across accounts and regions

VPE gateways support connectivity across IBM Cloud accounts and regions. This enables you to privately and securely connect your VPC resources to IBM Cloud service instances hosted in other accounts or regions.

Use this capability to connect workloads running in your VPC to IBM Cloud services, regardless of which account hosts those services. Platform services also use VPE to enable private, cross-account access for automation and service integration.

To create a cross-account VPE gateway, see [Creating an endpoint gateway](https://cloud.ibm.com/docs/vpc?topic=vpc-ordering-endpoint-gateway&interface=ui).

## Local-access VPE gateway support

You can create local-access VPEs in DNS-shared VPCs that are part of a DNS-sharing VPC topology. Each local-access VPE can handle traffic for specific service resources (for example, individual Object Storage buckets), while the hub VPC VPE continues to manage requests for the rest of the service resources (for example, all other Object Storage buckets).

This capability enables granular access control to service resources through Context-Based Restrictions (CBR), security groups, and network ACLs. It also helps ensure that data traffic from local-access VPEs does not traverse the hub VPC.

## Related links

These links provide additional information about IBM Cloud® VPE for VPC:

-   [VPE CLI reference](https://cloud.ibm.com/docs/vpc?topic=vpc-vpc-reference#vpe-clis)
-   [VPE API reference](https://cloud.ibm.com/docs/apis/vpc/latest?list-endpoint-gateways=#list-endpoint-gateways)
-   [FAQs for virtual private endpoints](https://cloud.ibm.com/docs/vpc?topic=vpc-faqs-vpe)
-   [VPE for VPC infrastructure resources for Terraform (opens in a new tab)](https://registry.terraform.io/providers/IBM-Cloud/ibm/latest/docs/data-sources/is_virtual_endpoint_gateway) (VPC infrastructure > Resources)
-   [Troubleshooting VPE gateways](https://cloud.ibm.com/docs/vpc?group=tbs-vpe-gateway)
-   [VPE activity tracking events](https://cloud.ibm.com/docs/vpc?topic=vpc-at_events#events-vpe)