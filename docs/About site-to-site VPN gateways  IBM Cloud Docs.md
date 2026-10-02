## 

You can use the IBM Cloud VPN for VPC service to securely connect your Virtual Private Cloud (VPC) to another private network. Use a route-based VPN, or a policy-based VPN to set up an IPsec site-to-site tunnel between your VPC and your on-premises private network or another VPC.

## VPN for VPC features

The IBM Cloud site-to-site VPN for VPC service includes the following features:

-   **Authentication** - IBM Cloud VPN for VPC supports a pre-shared key for Phase 1 peer authentication. Supported authentication algorithms for both phases include `SHA-256`, `SHA-384`, and `SHA-512`.
    
-   **High availability** - IBM Cloud VPN for VPC is built on two VPN devices to provide appliance-level redundancy. A policy-based VPN operates in Active-Standby mode with a single VPN gateway IP shared between the members, whereas a route-based VPN offers both Active-Backup and Active-Active redundancy modes with two VPN gateway IPs.
    
    Important: In the Active-Backup mode for a route-based VPN, two tunnels are set up between the IBM gateway and the peer VPN gateway. However, the IBM gateway always uses the tunnel with the smaller public IP as the primary egress path. The other tunnel, with the larger IP, acts as the secondary egress path. As long as both tunnels are active, traffic from the IBM VPC to the on-prem network goes through the primary egress path. If the primary egress path fails, traffic automatically switches to the secondary egress path. This setup is used when the "Distribute traffic" feature isn't enabled. The on-prem VPN gateway must also use the same configuration to choose the same preferred path. [Learn more](https://cloud.ibm.com/docs/vpc?topic=vpc-using-vpn#active-backup-mode-static)
    
-   **Dead peer detection** - Configurable mechanism to detect the availability of an IPsec peer.
    
-   **Diffie-Hellman (DH)** - Key exchange protocol used in Phase 1 to generate a shared secret key between VPN peers. Optionally, users can enable Perfect Forward Secrecy (PFS) and a DH group for Phase 2 IPsec negotiation. IBM Cloud VPN for VPC supports DH groups `14-24` and `31`.
    
-   **Encryption** - IBM Cloud VPN for VPC supports `AES-128`, `AES-192`, and `AES-256` for data encryption during both IKE Phase 1 and Phase 2.
    
-   **Internet Key Exchange (IKE)** - IKE is a part of the IPsec protocol that is used to establish VPN connections. In IKE Phase 1, VPN peers use Diffie-Hellman (DH) key exchange to create a secure, authenticated communication channel. In IKE Phase 2, the peers use the secure channel from Phase 1 to negotiate parameters for IPsec tunnels. IBM Cloud VPN for VPC supports both IKEv1 (main mode) and IKEv2. See [About policy negotiation](https://cloud.ibm.com/docs/vpc?topic=vpc-using-vpn#policy-negotiation) for the supported combinations.
    
-   **IPsec** - Protocol suite that provides secure communication between devices. IBM Cloud VPN for VPC uses UDP Encapsulation of IPsec Encapsulating Security Protocol (ESP) Packets in tunnel mode, which offers authentication and entire packet encryption.
    
-   **VPN gateway modes** - IBM Cloud VPN for VPC offers _policy-based_ and _route-based_ VPN gateway modes.
    
    -   **Policy-based VPN** - With a policy-based VPN, traffic that matches the negotiated CIDR ranges based on defined security policies passes through the VPN.
        
    -   **Route-based VPN** - For a route-based VPN, virtual tunnel interfaces are created based on routing table entries and any traffic that is routed toward these logical interfaces with custom routes passes through the VPN. Both VPN options provide the same features.
        
        Route-based VPNs further support static and dynamic VPN connections.
        
        -   **Static VPN connection** - In the static route-based connection, users must manually define and configure routes in the routing table. To get started, select **Static** as the mode when you create a VPN gateway and [create routes](https://cloud.ibm.com/docs/vpc?topic=vpc-create-vpc-route) by using the VPN connection type.
        -   **Dynamic VPN connection** - In the dynamic route-based connection, the routes are automatically discovered and managed between networks by using BGP, unlike static routing, which requires manual configuration. Dynamic configuration provides better scalability, network management, and high availability. To get started, select **dynamic** as the connection type when you create a VPN gateway. Keep in mind that you must use this connection along with a transit gateway. See [Planning considerations](https://cloud.ibm.com/docs/vpc?topic=vpc-planning-considerations-vpn&interface=ui#dynamic-route-based-connection-considerations) for dynamic route-based VPN.
-   **Perfect Forward Secrecy (PFS)** - PFS makes sure that DH-generated keys aren't used again during IPsec renegotiation. If a key is compromised, only data in transit during the protected security association's lifetime is accessible.
    

## Getting started with VPN gateways

Before you create a VPN, you must first [create a VPC and one or more subnets](https://cloud.ibm.com/docs/vpc?topic=vpc-getting-started) for your VPN and other resources.

Tip: Although not required, it is recommended to dedicate a subnet of at least 16 IPs (prefix `/28` or lower) for your VPN gateway. If you decide to provision extra resources within the VPN subnet, make sure that there are always at least 4 IPs available for recovery and maintenance tasks for use by the VPN gateway. In addition to the 4 IPs needed by the VPN gateway, up to 5 IPs in a subnet are reserved for internal network use so make sure that the subnet is large enough.

To create a VPN gateway, follow these general steps:

1.  Make sure that the [network ACLs](https://cloud.ibm.com/docs/vpc?topic=vpc-configuring-acls-vpn) are configured to allow VPN traffic to flow between your on-premises network and IBM Cloud VPN gateway.
    
2.  Make sure that your peer device supports NAT traversal and that it is enabled on the peer device. For more information, see [Known issues for VPN gateways](https://cloud.ibm.com/docs/vpc?topic=vpc-vpn-limitations).
    
3.  Review [planning considerations](https://cloud.ibm.com/docs/vpc?topic=vpc-planning-considerations-vpn) and [create your VPN gateway](https://cloud.ibm.com/docs/vpc?topic=vpc-vpn-create-gateway).
    
4.  [Create VPN connections](https://cloud.ibm.com/docs/vpc?topic=vpc-vpn-adding-connections) to establish a connection between your VPN gateway and your on-premises network.
    
    Note: IBM Cloud VPN for VPC supports only one route-based VPN per zone per VPC.
    
5.  For a static route-based VPN connection, select or [create a routing table for static routing](https://cloud.ibm.com/docs/vpc?topic=vpc-create-vpc-routing-table), then [create routes](https://cloud.ibm.com/docs/vpc?topic=vpc-create-vpc-route) by using the **VPN connection** type.
    
6.  For a dynamic route-based VPN connection, [create a transit gateway](https://cloud.ibm.com/docs/transit-gateway?topic=transit-gateway-ordering-transit-gateway&interface=ui) and associate it with the VPN gateway. If you have an existing transit gateway, you can also attach it to the VPN gateway. See [Adding a connection](https://cloud.ibm.com/docs/transit-gateway?topic=transit-gateway-adding-connections&interface=ui#tg-ui-adding-connection-transit-gateway). For information on creating a dynamic route-based connection with a transit gateway, see the following use cases:
    
    -   [Single-zone dynamic route-based VPN connection with Transit Gateway](https://cloud.ibm.com/docs/vpc?topic=vpc-using-vpn#use-case-5-vpn).
    -   [Cross-zone VPN dynamic route-based VPN connection with Transit Gateway](https://cloud.ibm.com/docs/vpc?topic=vpc-using-vpn#use-case-6-vpn)
    -   [VPN connection as a backup of direct link](https://cloud.ibm.com/docs/vpc?topic=vpc-using-vpn#use-case-7-vpn).
    -   [High availability dynamic route-based VPN with zonal affinity](https://cloud.ibm.com/docs/vpc?topic=vpc-using-vpn#use-case-8-vpn).
7.  [Connect to an on-premises network through a VPN tunnel](https://cloud.ibm.com/docs/vpc?topic=vpc-vpn-onprem-example).
    
8.  Verify that your VPN connection is available by sending a ping or data traffic across the tunnel to devices that are on the peer network.
    

## Architecture

This diagram illustrates an example VPN setup with multiple on-premises networks. The VPN is configured on a subnet within a user's VPC, but can be shared by instances on all subnets within the zone. The IKE and IPsec policies can also be used by one or more VPN connections.

![VPN setup example](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/vpc/images/vpn-setup.svg)

Figure 1. VPN setup example

## About policy negotiation

For both phases of IKE negotiation, the IPsec peers must exchange proposals of security parameters that each is configured to support, and to agree on a set of configurations. The custom IKE and IPsec policies allow IBM Cloud VPN for VPC users to configure these security parameters used during this negotiation.

The use of IKE and IPsec policies to configure a VPN connection is optional. When a policy is not selected, default proposals are chosen automatically through a process that is known as _auto-negotiation_.

The main security parameters that are involved in this negotiation process are as follows:

-   IKE phase
-   Encryption algorithm
-   Authentication algorithm
-   Diffie-Hellman Group (encryption key exchange protocol)

Tip: Because IBM Cloud auto-negotiation uses **IKEv2**, the on-premises device must also use **IKEv2**. Use a customized IKE policy if your on-premises device does not support **IKEv2**.

### IKE auto-negotiation (Phase 1)

You can use the following encryption, authentication, and Diffie-Hellman Group options in any combination:

|  | 
Encryption

 | 

Authentication

 | 

DH group

 |
| --- | --- | --- | --- |
| 1 | aes128 | sha256 | 14-24, 31 |
| 2 | aes192 | sha384 | 14-24, 31 |
| 3 | aes256 | sha512 | 14-24, 31 |

Table 1. Encryption, authentication, and DH group options for IPsec auto-negotiation Phase 1

### IPsec auto-negotiation (Phase 2)

You can use the following encryption and authentication options in any combination, or use the following combined-mode encryption options that require authentication to be disabled.

Important: By default, PFS is disabled for IBM Cloud VPN for VPC. Some vendors require PFS enablement for Phase 2. Check your vendor instructions and use custom policies if PFS is required.

|  | 
Encryption

 | 

Authentication

 | 

DH group

 |
| --- | --- | --- | --- |
| 1 | aes128 | sha256 | Disabled |
| 2 | aes192 | sha384 | Disabled |
| 3 | aes256 | sha512 | Disabled |

Table 2. Encryption and authentication options for IPsec auto-negotiation Phase 2

|  | 
Encryption

 | 

Authentication

 | 

DH group

 |
| --- | --- | --- | --- |
| 1 | aes128gcm16 | Disabled | Disabled |
| 2 | aes192gcm16 | Disabled | Disabled |
| 3 | aes256gcm16 | Disabled | Disabled |

Table 3. Combined-mode encryption options for IPsec auto-negotiation Phase 2

## VPN for VPC use cases

### Use case 1: VPN connection to a single remote peer device of the same type that is associated with one or more peer networks

Both route-based and policy-based VPNs allow users to connect to a single remote peer device associated with one or more networks.

Important: This use case is not applicable for connections between a policy-based VPN and a route-based VPN. For more information, see [Known issues for VPN gateways](https://cloud.ibm.com/docs/vpc?topic=vpc-vpn-limitations).

![Single peer VPN use case](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/vpc/images/vpn-single-peer.svg)

Figure 2. Single peer VPN use case

### Use case 2: VPN connections to multiple remote peer devices

Both policy-based and route-based VPNs allow users to connect to multiple remote peer devices associated with different VPCs or environments by using multiple VPN connections.

![Multiple peers VPN use case](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/vpc/images/vpn-multiple-peers.svg)

Figure 3. Multiple Peers VPN use case

### Use case 3: VPN advanced configuration using an FQDN

The following use case illustrates a customer that has one VPC in IBM Cloud and wants to connect their on-prem site with a single VPN gateway. The on-premises site VPN gateway is behind a NAT device and has no public IP address. In this case, you can associate an FQDN (fully qualified domain name) with the NATed IP address. You can then use this FQDN instead of an IP address when you create a VPN connection. The local IKE identity of the on-premises VPN gateway is the private IP address it owns. One FQDN is associated with the public IP address of the NAT device.

![VPN advanced configuration with FQDN](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/vpc/images/vpn-advanced-configuration.svg)

Figure 4. VPN advanced configuration with FQDN

### Use case 4: Distributing traffic for a route-based VPN

A route-based VPN comes with 2 public IPs. You can choose to connect to one or both IPs for redundancy. If you want to connect to one public IP, you can choose either one of them. However, if you want to connect to both public IPs, you have the following options:

#### Active-Backup mode for a route-based VPN connection

In this mode, only 1 tunnel is used at any time to route the VPN traffic over the tunnel.

The VPN always uses the tunnel with the smaller public IP as the primary egress path. When the primary egress path is disabled, traffic flows through the secondary path. The reason for using only one tunnel to route the traffic is to avoid the asymmetric routing problem.

For example, when both `tunnel 1` and `tunnel 2` are up in a static route-based VPN connection, and you create a route with destination `10.1.0.0/24` and VPN connection as the next hop, the private IP `10.254.0.2` of the VPN appliance is returned for route creation. In this mode, **Distribute traffic** isn't enabled. The following diagram depicts the default configuration for a static route-based connection.

Note: Protocol state filtering on a virtual network interface provides options to address the asymmetric routing problem. For more information, see [Protocol state filtering mode](https://cloud.ibm.com/docs/vpc?topic=vpc-vni-about&interface=ui#protocol-state-filtering).

![Distributed traffic disabled: ](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/vpc/images/vpn-distribute-traffic-disabled.svg)

Figure 5. Distributed traffic feature is disabled for static connection

The behavior of active-backup mode for a dynamic route-based VPN connection is similar to a static connection. However, you don't have to create routes because they are automatically discovered by the transit gateway. In this case, only 1 tunnel is used to route the VPN traffic over the tunnel at any time. The VPN always uses the tunnel with the smaller public IP as the primary egress path. When the primary egress path is disabled, traffic flows through the secondary path. The subnet in which the virtual server instance is placed `10.255.0.0/24` must be different from the VPN gateway subnet `10.254.0.0/24` for the transit gateway to route traffic between them. The following diagram depicts the default configuration for a dynamic route-based connection.

![Distributed traffic disabled: ](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/vpc/images/vpn-distribute-traffic-disabled-dynamic.svg)

Figure 6. Distributed traffic feature is disabled for dynamic connection

#### Active-Active mode for route-based VPN connection

In this mode, the traffic egress is routed to the 2 tunnels dynamically.

For example, when both `tunnel 1` and `tunnel 2` are up and you create a route with destination `10.1.0.0/24` and VPN connection as the next hop, the private IP addresses `10.254.0.2` and `10.254.0.3` are returned and the VPC network service creates 2 routes. Because these routes have the same priority, traffic flows to `tunnel 1` and `tunnel 2` dynamically when a VPC route's next hop is the VPN connection. To accomplish this active-active redundancy mode, you must enable the **Distribute traffic** checkbox when [creating](https://cloud.ibm.com/docs/vpc?topic=vpc-vpn-create-gateway&interface=ui) or [adding](https://cloud.ibm.com/docs/vpc?topic=vpc-vpn-adding-connections&interface=ui) connections to a VPN gateway. The following diagram depicts this configuration for a static route-based connection.

![Distributed traffic enabled: active-active VPN route](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/vpc/images/vpn-distribute-traffic-enabled.svg)

Figure 7. Distributed traffic feature is enabled for static connection

Note: To use this feature and get higher network performance, the on-premises device must support asymmetric routing. Also, keep in mind that not all on-premises VPN gateways support this use case. For example, if the VPN traffic egress and ingress are from different tunnels, the traffic might be blocked by on-premises VPN devices or firewalls.

The behavior of the active-active mode for a dynamic route-based VPN connection is similar to that of a static route-based connection. When you enable the **Distribute traffic** checkbox when adding connections to a VPN gateway, traffic flows through both tunnels simultaneously. The transit gateway handles route discovery, learning, and management. The following diagram depicts the default configuration for a dynamic route-based connection.

![Distributed traffic enabled: active-active VPN route](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/vpc/images/vpn-distribute-traffic-enabled-dynamic.svg)

Figure 8. Distributed traffic feature is enabled for dynamic connection

### Use case 5: Single-zone dynamic route-based VPN connection with Transit Gateway

With the dynamic route-based VPN, you can establish a single-zone VPN connection between your VPC and your on-prem private network by using Transit Gateway. This setup enables automatic route discovery, bidirectional traffic flow, and dynamic route exchange between the devices, which simplifies network management and reduces manual configuration.

![Single-zone dynamic route-based VPN with transit gateway](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/vpc/images/vpn-tgw.svg)

Figure 9. Single-zone dynamic route-based VPN with transit gateway

### Use case 6: Cross-zone VPN dynamic route-based VPN connection with Transit Gateway

To achieve full regional high availability for VPN connectivity, you can provision a VPN gateway in each availability zone and establish separate VPN connections from the transit gateway to each VPN gateway. This setup helps ensure cross-zone redundancy, allowing continuous packet flow and dynamic route exchange even if one zone experiences a failure.

![Cross-zone dynamic route-based VPN with transit gateway](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/vpc/images/vpn-tgw-cross-zone.svg)

Figure 10. Cross-zone dynamic route-based VPN with transit gateway

### Use case 7: VPN connection as a backup of direct link

You can attach both direct link and VPN connections to a transit gateway to enable high availability and flexible routing. When you add routes to the VPN gateway, traffic prefers the direct link path over the VPN path in normal conditions. If the direct link connection fails, traffic automatically switches over to the VPN connection, which helps maintain uninterrupted connectivity between networks. You must configure BGP routing preferences on your end so that the direct link is prioritized over VPN. You can configure this routing preference by setting a shorter AS path for the direct link and a longer AS path for the VPN so that the direct link is preferred.

![VPN connection as a backup of direct link](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/vpc/images/vpn-tgw-dl.svg)

Figure 11. VPN connection as a backup of direct link

### Use case 8: High availability dynamic route-based VPN with zonal affinity

You can achieve high availability for a dynamic, route-based VPN setup by deploying IBM Cloud VPN gateways in multiple zones. This configuration introduces zonal affinity, which means that when a Power Virtual Server, Transit Gateway, and VPN connection are all located in the same zone, traffic is routed preferentially through that zone. Traffic shifts to another zone only if the VPN gateway in the current zone becomes unavailable.

VPN traffic is secured by using IPsec, and automatic route discovery is enabled with BGP. Your on-premises network can connect to power virtual servers through the transit gateway. As illustrated in the diagram, two VPN tunnels are established when you create a dynamic route-based VPN connection. If you enable the **Distribute traffic** option, traffic dynamically flows through both tunnels, which provides a higher throughput.

![VPN connection with transit gateway and power servers](https://cloud.ibm.com/docs/api/docs-content/v4/content/feed8566203a6a6d4e00b720bdd064fb01c11a0f/vpc/images/vpn-tgw-pw.svg)

Figure 12. VPN connection with transit gateway and power servers

To set up this configuration, follow these steps:

1.  Provision a VPN gateway in Zone 1 and Zone 3. See [Creating a VPN gateway](https://cloud.ibm.com/docs/vpc?topic=vpc-vpn-create-gateway&interface=ui).
2.  Add a VPN connection to the provisioned gateway to connect to your on-premises network. See [Adding connections to a VPN gateway](https://cloud.ibm.com/docs/vpc?topic=vpc-vpn-adding-connections&interface=ui).
3.  Set up a connection between IBM Cloud VPN and Transit Gateway. See [Creating a transit gateway](https://cloud.ibm.com/docs/transit-gateway?topic=transit-gateway-ordering-transit-gateway&interface=ui#tg-ui-creating-transit-gateway).

## Related links

These links provide additional information about IBM Cloud VPN for VPC:

-   [VPN CLI reference](https://cloud.ibm.com/docs/vpc?topic=vpc-vpc-reference#vpn-clis)
-   [VPN API reference](https://cloud.ibm.com/docs/apis/vpc/latest#list-ike-policies)
-   [VPN Terraform reference (opens in a new tab)](https://registry.terraform.io/providers/IBM-Cloud/ibm/latest/docs/resources/is_vpn_gateway)
-   [Managing IAM access for VPC Infrastructure Services](https://cloud.ibm.com/docs/vpc?topic=vpc-iam-getting-started&interface=ui)
-   [Activity tracking events](https://cloud.ibm.com/docs/vpc?topic=vpc-at_events#events-vpns)
-   [Logging for VPC](https://cloud.ibm.com/docs/vpc?topic=vpc-logging)
-   [FAQs for VPN gateways](https://cloud.ibm.com/docs/vpc?topic=vpc-faqs-vpn)
-   [Troubleshooting VPN gateways](https://cloud.ibm.com/docs/vpc?group=tbs-site-to-site-vpn-gateways)
-   [VPN gateway quotas](https://cloud.ibm.com/docs/vpc?topic=vpc-quotas#vpn-quotas)