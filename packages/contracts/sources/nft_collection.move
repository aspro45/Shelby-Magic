module nft_collection::nft_collection {
    use aptos_framework::object::{Self, ConstructorRef};
    use aptos_framework::signer;
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use std::string::{Self, String};
    use std::option;
    use std::vector;

    // ============================
    // Resources
    // ============================

    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    /// NFT Collection stored at creator's address
    struct NFTCollection has key {
        name: String,
        description: String,
        creator: address,
        uri: String,          // Shelby blob URL for collection image/metadata
        max_supply: u64,
        minted: u64,
        royalty_numerator: u16,
        royalty_denominator: u16,
        created_at: u64,
        updated_at: u64,
    }

    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    /// Individual NFT token stored inside an Object
    struct NFTToken has key {
        collection: String,
        name: String,
        description: String,
        uri: String,          // Shelby blob URL for token metadata
        creator: address,
        created_at: u64,
    }

    // ============================
    // Events
    // ============================

    #[event]
    struct CollectionCreated has drop, store {
        creator: address,
        name: String,
        max_supply: u64,
        timestamp: u64,
    }

    #[event]
    struct NFTMinted has drop, store {
        collection: String,
        token_name: String,
        token_address: address,
        owner: address,
        timestamp: u64,
    }

    #[event]
    struct NFTTransferred has drop, store {
        token_address: address,
        from: address,
        to: address,
        timestamp: u64,
    }

    // ============================
    // Error codes
    // ============================

    const E_COLLECTION_ALREADY_EXISTS: u64 = 1;
    const E_SUPPLY_EXHAUSTED: u64 = 2;
    const E_NOT_OWNER: u64 = 3;
    const E_COLLECTION_NOT_FOUND: u64 = 4;

    // ============================
    // Public entry functions
    // ============================

    /// Create a new NFT collection. Stores state at creator's address.
    public entry fun create_collection(
        creator: &signer,
        name: String,
        description: String,
        uri: String,
        max_supply: u64,
        royalty_numerator: u16,
        royalty_denominator: u16,
    ) {
        let creator_addr = signer::address_of(creator);
        assert!(!exists<NFTCollection>(creator_addr), E_COLLECTION_ALREADY_EXISTS);

        let now = timestamp::now_seconds();
        let collection = NFTCollection {
            name,
            description,
            creator: creator_addr,
            uri,
            max_supply,
            minted: 0,
            royalty_numerator,
            royalty_denominator,
            created_at: now,
            updated_at: now,
        };
        move_to(creator, collection);

        event::emit(CollectionCreated {
            creator: creator_addr,
            name,
            max_supply,
            timestamp: now,
        });
    }

    /// Mint a new NFT token from a collection. Creates an Object to hold the NFT.
    public entry fun mint_nft(
        creator: &signer,
        collection_name: String,
        token_name: String,
        description: String,
        uri: String,
        recipient: address,
    ) acquires NFTCollection {
        let creator_addr = signer::address_of(creator);
        assert!(exists<NFTCollection>(creator_addr), E_COLLECTION_NOT_FOUND);

        let collection = borrow_global_mut<NFTCollection>(creator_addr);
        assert!(collection.minted < collection.max_supply, E_SUPPLY_EXHAUSTED);

        let now = timestamp::now_seconds();

        // Create a named Object for the NFT (deterministic address)
        let seed = *string::bytes(&token_name);
        let constructor: ConstructorRef = object::create_named_object(creator, seed);
        let token_signer = object::generate_signer(&constructor);
        let token_addr = signer::address_of(&token_signer);

        // Store NFT data inside the object
        move_to(&token_signer, NFTToken {
            collection: collection_name,
            name: token_name,
            description,
            uri,
            creator: creator_addr,
            created_at: now,
        });

        // Transfer the object to the recipient
        let transfer_ref = object::generate_transfer_ref(&constructor);
        let linear_ref = object::generate_linear_transfer_ref(&transfer_ref);
        object::transfer_with_ref(linear_ref, recipient);

        // Update collection stats
        collection.minted = collection.minted + 1;
        collection.updated_at = now;

        event::emit(NFTMinted {
            collection: collection_name,
            token_name,
            token_address: token_addr,
            owner: recipient,
            timestamp: now,
        });
    }

    /// Transfer an NFT token to another address.
    public entry fun transfer_nft(
        owner: &signer,
        token_address: address,
        to: address,
    ) {
        let owner_addr = signer::address_of(owner);
        let token_obj = object::address_to_object<NFTToken>(token_address);
        assert!(object::is_owner(token_obj, owner_addr), E_NOT_OWNER);
        object::transfer(owner, token_obj, to);

        event::emit(NFTTransferred {
            token_address,
            from: owner_addr,
            to,
            timestamp: timestamp::now_seconds(),
        });
    }

    // ============================
    // View functions
    // ============================

    #[view]
    public fun get_collection(creator: address): (String, u64, u64, u16, u16) acquires NFTCollection {
        let c = borrow_global<NFTCollection>(creator);
        (c.name, c.minted, c.max_supply, c.royalty_numerator, c.royalty_denominator)
    }

    #[view]
    public fun get_token(token_address: address): (String, String, address) acquires NFTToken {
        let t = borrow_global<NFTToken>(token_address);
        (t.collection, t.name, t.creator)
    }

    // ============================
    // Tests
    // ============================

    #[test_only]
    use aptos_framework::account;

    #[test(aptos_framework = @aptos_framework, creator = @0xCAFE)]
    fun test_create_collection(aptos_framework: &signer, creator: &signer) acquires NFTCollection {
        timestamp::set_time_has_started_for_testing(aptos_framework);
        account::create_account_for_test(signer::address_of(creator));

        create_collection(
            creator,
            string::utf8(b"Test Collection"),
            string::utf8(b"A test NFT collection"),
            string::utf8(b"https://api.testnet.shelby.xyz/blobs/test"),
            100,
            5,
            100,
        );

        let (name, minted, max_supply, royalty_num, royalty_den) = get_collection(signer::address_of(creator));
        assert!(name == string::utf8(b"Test Collection"), 0);
        assert!(minted == 0, 1);
        assert!(max_supply == 100, 2);
        assert!(royalty_num == 5, 3);
        assert!(royalty_den == 100, 4);
    }

    #[test(aptos_framework = @aptos_framework, creator = @0xCAFE)]
    fun test_mint_nft(aptos_framework: &signer, creator: &signer) acquires NFTCollection, NFTToken {
        timestamp::set_time_has_started_for_testing(aptos_framework);
        let creator_addr = signer::address_of(creator);
        account::create_account_for_test(creator_addr);

        create_collection(
            creator,
            string::utf8(b"MyCollection"),
            string::utf8(b"desc"),
            string::utf8(b"https://api.testnet.shelby.xyz/blobs/test"),
            10,
            5,
            100,
        );

        mint_nft(
            creator,
            string::utf8(b"MyCollection"),
            string::utf8(b"Token #1"),
            string::utf8(b"First token"),
            string::utf8(b"https://api.testnet.shelby.xyz/blobs/token1"),
            creator_addr,
        );

        let (_, minted, _, _, _) = get_collection(creator_addr);
        assert!(minted == 1, 0);
    }
}
