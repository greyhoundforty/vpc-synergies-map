## 

Context-based restrictions give account owners and administrators the ability to define and enforce access restrictions for IBM Cloud® resources based on the context of access requests. Access to VPC Infrastructure Services can be controlled with context-based restrictions and identity and access management (IAM) policies.

These restrictions work with traditional IAM policies, which are based on identity, to provide an extra layer of protection. Unlike IAM policies, context-based restrictions don't assign access. Context-based restrictions check that an access request comes from an allowed context that you configured. Since both IAM access and context-based restrictions enforce access, context-based restrictions offer protection even in the face of compromised or mismanaged credentials. For more information, see [What are context-based restrictions](https://cloud.ibm.com/docs/iam?topic=iam-context-restrictions-whatis).

Note: A user must have the Administrator role on the VPC Infrastructure Services to create, update, or delete rules that target VPC Infrastructure Services. A user must have either the Editor or Administrator role on the context-based restrictions service to create, update, or delete network zones. A user with the Viewer role on the context-based restrictions service can add network zones to a rule only.

The context-based restriction service generates audit logs every time when a context-based policy is enforced. For more information, see [Monitoring context-based restrictions](https://cloud.ibm.com/docs/iam?topic=iam-cbr-monitor).

To get started with protecting your VPC Infrastructure Services with context-based restrictions, see the tutorial for [Leveraging context-based restrictions to secure your resources](https://cloud.ibm.com/docs/iam?topic=iam-context-restrictions-tutorial).

## How VPC Infrastructure Services integrates with context-based restrictions

VPC Infrastructure Services is a composite service that is made up of a number of child services. Context-based restrictions can be created for IBM Cloud VPC or any of its child services; for example, [subnets](https://cloud.ibm.com/docs/vpc?topic=vpc-about-subnets-vpc), [virtual server instances](https://cloud.ibm.com/docs/vpc?topic=vpc-vsi_best_practices), and [Block Storage volumes](https://cloud.ibm.com/docs/vpc?topic=vpc-creating-block-storage&interface=cli).

See the [rule creation section](https://cloud.ibm.com/docs/vpc?topic=vpc-fs-snapshots-planning#cbr-rules) for details on how you can create rules with the required attributes for each service.

## Creating network zones

A network zone represents an allowlist of IP addresses where an access request is created. It defines a set of one or more network locations that are specified by the following attributes:

-   IP addresses, which include individual addresses, ranges, or subnets
-   VPCs
-   Service references, which allow access from other IBM Cloud® services

### Service references

A \*service reference, which is defined as part of a network zone, allows the specified service to talk to the restricted resources or APIs that are targeted by a context-based restriction policy. The following table contains the service references that need to be included when context-based restrictions are used in the context of VPC Infrastructure Services. You can also look at the [service-to-service IAM authorizations](https://cloud.ibm.com/docs/iam?topic=iam-serviceauth&interface=ui) in your account when you deliberate which service references to add in your network zone. You can find service-to-service authorization in your account by going to **Manage -> Access (IAM)** and selecting the **Authorizations** tab.

### Creating network zones from the console

1.  Determine which resources you want to add to your allowlist.
2.  Check the [service references](https://cloud.ibm.com/docs/vpc?topic=vpc-fs-snapshots-planning#service-references) section to see whether you need to add any service reference to your network zone.
3.  Follow these steps to [create context-based restrictions in the console](https://cloud.ibm.com/docs/iam?topic=iam-context-restrictions-create).

## Creating rules

Within VPC Infrastructure Services, each child service needs certain attributes in a context-based rule.

When you use the API, Terraform or the IBM Cloud CLI to create, update, or delete IBM Cloud context-based restrictions, you can specify the target VPC Infrastructure resource by using resource attributes.

Tip: See [VPC resource attributes](https://cloud.ibm.com/docs/vpc?topic=vpc-resource-attributes) for the resource attributes that correspond with individual VPC resources.

You can select a resource by entering the ID of the object. Alternatively, you can use the `*` wildcard to select all applicable resources. For example, the attribute `vpcId:*` sets the context-based restrictions to apply to all VPCs in the account. You can also specify which resource group the policy is applied to in the command.

### Creating rules in the console

1.  Go to **Manage** > **Context-based restrictions** in the IBM Cloud® console.
    
2.  Select **Rules** and click **Create**.
    
3.  Select **VPC Infrastructure Services** and click **Next**.
    
4.  Scope the rule to **All resources** or **Specific resources**. For more information, see [Protecting VPC Infrastructure Services resources](https://cloud.ibm.com/docs/vpc?topic=vpc-cbr). Click **Continue**.
    
5.  Define the allowed endpoint types.
    
    -   Keep the toggle set to **No** to allow all endpoint types.
    -   Set the toggle to **Yes** to allow only specific endpoint types, then choose from the list.
6.  Select an existing network zone or zones, or create a network zone by clicking **Create**.
    
    Tip: Contexts define the location from which your resources can be accessed, effectively linking your network zone to your rule.
    
7.  Click **Add** to add your configuration to the summary. Click **Next**.
    
8.  Name your rule and select how you want to enforce it. Then, click **Create**.
    

## Monitoring context-based restrictions in VPC Infrastructure Services

The context-based restriction service generates audit logs every time when a context-based policy is enforced. For more information, see [Monitoring context-based restrictions](https://cloud.ibm.com/docs/iam?topic=iam-cbr-monitor).

## Troubleshooting failures due to context-based restrictions

### 403 Unauthorized error messages

When a request is denied because of improper access permissions or the request originates outside of the network zone that is defined in context-based restrictions rule, the error response is similar to the following examples.

#### 403 unauthorized error in the IBM Cloud console

```
reference_id b266a31c-b359-4ecb-8b81-a27c1b2cdb7b
code not_authorized
message the provided token is not authorized
```

### Locating context-based restriction events

You can use the value of `Trace ID` or `Reference ID` to search in your IBM Cloud Logs instance for the events that are generated by the context-based restrictions service. The `requestData.environment` section shows the source IP address of the call and other information that you can use to verify why the authorization was denied. The `requestData.action` and `requestData.resource` fields can be used determine which underlying resource was denied access.

The following example is a context-based restriction event. Some fields were removed to improve readability.

You can then use the same Trace ID or Reference ID to look at the specific VPC Infrastructure service event in your IBM Cloud Logs instance.

You can also search events by using a resource identifier. A resource ID is a UUID and is the last identifier in a CRN. See the following example

```
crn:v1:bluemix:public:is:au-syd:a/67db3d7ff3f34220b40e2d81480754c9::vpc:<resourceID>
```

Requests for provisioning resources do not contain a resource ID.

If you do not find a context-based restriction event in the IBM Cloud Logs, it's possible that access was denied due to IAM access policies. For more information, see the [VPC IAM getting started guide](https://cloud.ibm.com/docs/vpc?topic=vpc-iam-getting-started).

### Client-to-site VPN data plane impact with context-based restrictions

If you enable **User ID and passcode** in the [client authentication](https://cloud.ibm.com/docs/vpc?topic=vpc-client-to-site-vpn-planning#client-authentication) configuration for a client-to-site VPN, and create context-based rules on VPC resources, the client connection to the VPN is impacted by context-based restrictions. If the VPN client remote IP is not in the **Network Zone**, the connection to the VPN server returns an `Auth Failed` error.

After the VPN client connects to the VPN server, the requests to the VPE endpoint or Cloud Service Endpoint (CSE) are controlled with context-based restrictions. Also, the requests' source IP is the VPC [Cloud service endpoint source addresses](https://cloud.ibm.com/docs/vpc?topic=vpc-vpc-behind-the-curtain#cse-source-addresses). Make sure that the VPC CSE source addresses are in the CBR Network Zone; otherwise, the request is denied.

## Limitations

-   Context-based restrictions protect only the actions that are associated with the [VPC Infrastructure Services APIs](https://cloud.ibm.com/docs/apis/vpc) or the `is` plug-in of the IBM CLI. The SDK and Terraform options are also supported. Actions that are associated with the following platform APIs are _not_ protected by context-based restrictions:
    -   [Resource Instance List APIs](https://cloud.ibm.com/docs/apis/resource-controller/resource-controller#list-resource-instances)
    -   [Resource Instance Delete resource API](https://cloud.ibm.com/docs/apis/resource-controller/resource-controller#delete-resource-instance)
    -   [Global Search APIs](https://cloud.ibm.com/docs/apis/search)
    -   Global Tagging [Attach](https://cloud.ibm.com/docs/apis/tagging#attach-tag) and [Detach](https://cloud.ibm.com/docs/apis/tagging#detach-tag) APIs
-   When you create a rule, it might take up to 10 minutes to become enforced.
-   Due to a limitation that is being addressed, context-based restrictions must not be in place for [Secrets Manager APIs](https://cloud.ibm.com/docs/apis/secrets-manager) when you use the [Load balancer for VPC service](https://cloud.ibm.com/docs/vpc?topic=vpc-nlb-vs-elb). Because it results in failing to attach the certificates to the listener that is associated with the load balancer.